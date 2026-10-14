const express = require('express');
const router = express.Router();
const Email = require('../models/Email');
const Lead = require('../models/Lead');
const EmailSettings = require('../models/EmailSettings');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendDirectClientEmail, getActiveEmailCredentials } = require('../services/emailService');
const { parseMimeEmail, extractVerificationCode, detectSpam } = require('../utils/emailParser');

// @desc    Cloudflare Email Worker Webhook (Incoming emails)
// @route   POST /api/email/incoming-webhook
// @access  Public (called by Cloudflare Email Worker)
router.post('/incoming-webhook', async (req, res) => {
    try {
        let payload = req.body;
        if (typeof payload === 'string') {
            try {
                payload = JSON.parse(payload);
            } catch (e) {
                payload = { raw: req.body, from: 'unknown@sender.com', to: 'alex@untressed.com', subject: 'Incoming Email', text: req.body };
            }
        }

        let { from, to, subject, text, html, raw } = payload || {};

        // If raw MIME content is provided, parse and extract body, codes & spam status
        let verificationCode = '';
        let isSpam = false;

        if (raw) {
            const parsed = parseMimeEmail(raw);
            if (!text && parsed.text) text = parsed.text;
            if (!html && parsed.html) html = parsed.html;
            if ((!subject || subject === '(No Subject)') && parsed.subject) subject = parsed.subject;
            if (!from && parsed.from) from = parsed.from;
            if (!to && parsed.to) to = parsed.to;
            verificationCode = parsed.verificationCode || '';
            isSpam = parsed.isSpam || false;
        } else {
            verificationCode = extractVerificationCode(subject || '', text || '', html || '');
            const spamCheck = detectSpam({}, subject || '', text || '');
            isSpam = spamCheck.isSpam;
        }

        if (!from || !to) {
            return res.status(400).json({ message: 'Missing "from" or "to" fields' });
        }

        // Clean sender and recipient email addresses
        const fromMatch = from.match(/<([^>]+)>/) || [null, from];
        const cleanFrom = (fromMatch[1] || from).trim().toLowerCase();
        
        const toMatch = to.match(/<([^>]+)>/) || [null, to];
        const cleanTo = (toMatch[1] || to).trim().toLowerCase();

        let fromName = from.replace(/<[^>]+>/, '').trim();
        if (fromName.startsWith('"') && fromName.endsWith('"')) {
            fromName = fromName.slice(1, -1).trim();
        }

        console.log(`[INCOMING EMAIL] From: ${cleanFrom} | To: ${cleanTo} | Subject: ${subject || '(No Subject)'} | OTP: ${verificationCode || 'None'} | Spam: ${isSpam}`);

        // Route to the specific user assigned to cleanTo address
        let targetUserId = null;
        try {
            const userSetting = await EmailSettings.findOne({
                emailUser: { $regex: new RegExp(`^${cleanTo}$`, 'i') }
            });

            if (userSetting && userSetting.userId) {
                targetUserId = userSetting.userId;
                console.log(`[INCOMING EMAIL] Routed to User ID: ${targetUserId} (${cleanTo})`);
            } else {
                // If address is catch-all, assign to Master user
                const masterUser = await User.findOne({ role: 'master' });
                if (masterUser) {
                    targetUserId = masterUser._id;
                }
            }
        } catch (routeErr) {
            console.warn('[INCOMING EMAIL] Error matching user setting:', routeErr.message);
        }

        // Try to match sender with an existing lead
        let matchedLead = null;
        try {
            matchedLead = await Lead.findOne({
                email: { $regex: new RegExp(`^${cleanFrom}$`, 'i') }
            });

            if (matchedLead) {
                console.log(`[INCOMING EMAIL] Matched lead: ${matchedLead.name} (${matchedLead._id}) - Tagging as HOT LEAD`);
                matchedLead.campaignStatus = 'replied';
                matchedLead.aiScore = 'Hot';
                if (['New', 'Contacted', 'Follow-up'].includes(matchedLead.status)) {
                    matchedLead.status = 'Hot';
                }

                matchedLead.activity.push({
                    description: `🔥 Prospect Replied: "${(subject || 'No Subject').substring(0, 50)}"`,
                    timestamp: new Date()
                });
                await matchedLead.save();

                // Send Hot Lead Notification Email to Master & Supervising Admin
                try {
                    const notifyEmails = [];
                    const master = await User.findOne({ role: 'master' });
                    if (master?.email) notifyEmails.push(master.email);

                    if (matchedLead.assignedAdmin) {
                        const adminUser = await User.findById(matchedLead.assignedAdmin);
                        if (adminUser?.email && !notifyEmails.includes(adminUser.email)) {
                            notifyEmails.push(adminUser.email);
                        }
                    }

                    if (process.env.NOTIFICATION_EMAIL && !notifyEmails.includes(process.env.NOTIFICATION_EMAIL)) {
                        notifyEmails.push(process.env.NOTIFICATION_EMAIL);
                    }

                    if (notifyEmails.length > 0) {
                        await sendDirectClientEmail({
                            to: notifyEmails[0],
                            subject: `🔥 HOT LEAD ALERT: ${matchedLead.name} replied to outreach!`,
                            text: `Hot Lead Alert!\n\nLead: ${matchedLead.name}\nEmail: ${matchedLead.email}\nPhone: ${matchedLead.phone}\nCourse: ${matchedLead.course || 'N/A'}\nSubject: ${subject || 'No Subject'}\nMessage:\n${(text || '').substring(0, 300)}\n\nPlease log in to CRM to assign or transfer this hot lead to a sales counselor.`
                        });
                    }
                } catch (alertErr) {
                    console.warn('[HOT LEAD EMAIL ALERT WARNING]', alertErr.message);
                }

                // Broadcast real-time hot_lead_alert via Socket.IO
                const io = req.app.get('io');
                if (io) {
                    io.emit('hot_lead_alert', {
                        leadId: matchedLead._id,
                        name: matchedLead.name,
                        email: matchedLead.email,
                        phone: matchedLead.phone,
                        subject: subject || 'New Reply',
                        snippet: (text || '').substring(0, 140),
                        assignedTo: matchedLead.assignedTo
                    });
                }
            }
        } catch (matchErr) {
            console.warn('[INCOMING EMAIL] Error matching lead:', matchErr.message);
        }

        const folder = isSpam ? 'spam' : 'inbox';

        // Save Email document with assigned userId
        const newEmail = await Email.create({
            from: cleanFrom,
            fromName: fromName || cleanFrom,
            to: cleanTo,
            subject: subject || '(No Subject)',
            text: text || '',
            html: html || (text ? `<p>${text.replace(/\n/g, '<br/>')}</p>` : ''),
            direction: 'inbound',
            folder: folder,
            isSpam: isSpam,
            isTrash: false,
            verificationCode: verificationCode || '',
            leadId: matchedLead ? matchedLead._id : null,
            userId: targetUserId,
            isRead: false,
            raw: raw || ''
        });

        // Broadcast real-time event
        const io = req.app.get('io');
        if (io) {
            io.emit('new_email', {
                _id: newEmail._id,
                from: newEmail.from,
                fromName: newEmail.fromName,
                to: newEmail.to,
                subject: newEmail.subject,
                snippet: (newEmail.text || '').substring(0, 100),
                timestamp: newEmail.createdAt,
                leadName: matchedLead ? matchedLead.name : null,
                userId: targetUserId,
                folder: newEmail.folder,
                isSpam: newEmail.isSpam,
                verificationCode: newEmail.verificationCode
            });
        }

        res.status(201).json({
            success: true,
            message: 'Email processed, routed, and saved',
            id: newEmail._id,
            assignedUserId: targetUserId,
            folder: newEmail.folder,
            verificationCode: newEmail.verificationCode
        });
    } catch (error) {
        console.error('[INCOMING EMAIL ERROR]', error);
        res.status(500).json({ message: error.message });
    }
});

// Helper to calculate folder counts
const getFolderCounts = async (user, filterUser, isAdmin) => {
    let baseQuery = {};
    if (!isAdmin) {
        baseQuery.userId = user._id;
    } else if (filterUser && filterUser !== 'all') {
        baseQuery.userId = filterUser;
    }

    const [unreadCount, spamCount, trashCount, starredCount] = await Promise.all([
        Email.countDocuments({ ...baseQuery, direction: 'inbound', folder: { $in: ['inbox', null] }, isTrash: { $ne: true }, isRead: false }),
        Email.countDocuments({ ...baseQuery, folder: 'spam', isTrash: { $ne: true } }),
        Email.countDocuments({ ...baseQuery, isTrash: true }),
        Email.countDocuments({ ...baseQuery, isStarred: true, isTrash: { $ne: true } })
    ]);

    return { unreadCount, spamCount, trashCount, starredCount };
};

// @desc    Get inbox (inbound) emails (User-scoped or Team-scoped)
// @route   GET /api/email/inbox
// @access  Private
router.get('/inbox', protect, async (req, res) => {
    try {
        const { search, leadId, filterUser } = req.query;
        let query = { 
            direction: 'inbound',
            folder: { $in: ['inbox', null] },
            isTrash: { $ne: true }
        };

        const isAdmin = ['master', 'admin', 'manager'].includes(req.user.role);

        if (!isAdmin) {
            query.userId = req.user._id;
        } else if (filterUser && filterUser !== 'all') {
            query.userId = filterUser;
        }

        if (leadId) {
            query.leadId = leadId;
        }

        if (search) {
            query.$or = [
                { subject: { $regex: search, $options: 'i' } },
                { from: { $regex: search, $options: 'i' } },
                { fromName: { $regex: search, $options: 'i' } },
                { text: { $regex: search, $options: 'i' } },
                { verificationCode: { $regex: search, $options: 'i' } }
            ];
        }

        const emails = await Email.find(query)
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('leadId', 'name phone email company')
            .populate('userId', 'name email role');

        const counts = await getFolderCounts(req.user, filterUser, isAdmin);

        res.json({ emails, ...counts });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get sent (outbound) emails (User-scoped or Team-scoped)
// @route   GET /api/email/sent
// @access  Private
router.get('/sent', protect, async (req, res) => {
    try {
        const { search, filterUser } = req.query;
        let query = { 
            direction: 'outbound',
            isTrash: { $ne: true }
        };

        const isAdmin = ['master', 'admin', 'manager'].includes(req.user.role);

        if (!isAdmin) {
            query.userId = req.user._id;
        } else if (filterUser && filterUser !== 'all') {
            query.userId = filterUser;
        }

        if (search) {
            query.$or = [
                { subject: { $regex: search, $options: 'i' } },
                { to: { $regex: search, $options: 'i' } },
                { text: { $regex: search, $options: 'i' } }
            ];
        }

        const emails = await Email.find(query)
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('leadId', 'name phone email company')
            .populate('userId', 'name email role');

        res.json(emails);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get starred emails
// @route   GET /api/email/starred
// @access  Private
router.get('/starred', protect, async (req, res) => {
    try {
        const { search, filterUser } = req.query;
        let query = { 
            isStarred: true,
            isTrash: { $ne: true }
        };

        const isAdmin = ['master', 'admin', 'manager'].includes(req.user.role);

        if (!isAdmin) {
            query.userId = req.user._id;
        } else if (filterUser && filterUser !== 'all') {
            query.userId = filterUser;
        }

        if (search) {
            query.$or = [
                { subject: { $regex: search, $options: 'i' } },
                { from: { $regex: search, $options: 'i' } },
                { to: { $regex: search, $options: 'i' } },
                { text: { $regex: search, $options: 'i' } }
            ];
        }

        const emails = await Email.find(query)
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('leadId', 'name phone email company')
            .populate('userId', 'name email role');

        res.json(emails);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get spam emails
// @route   GET /api/email/spam
// @access  Private
router.get('/spam', protect, async (req, res) => {
    try {
        const { search, filterUser } = req.query;
        let query = { 
            folder: 'spam',
            isTrash: { $ne: true }
        };

        const isAdmin = ['master', 'admin', 'manager'].includes(req.user.role);

        if (!isAdmin) {
            query.userId = req.user._id;
        } else if (filterUser && filterUser !== 'all') {
            query.userId = filterUser;
        }

        if (search) {
            query.$or = [
                { subject: { $regex: search, $options: 'i' } },
                { from: { $regex: search, $options: 'i' } },
                { text: { $regex: search, $options: 'i' } }
            ];
        }

        const emails = await Email.find(query)
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('leadId', 'name phone email company')
            .populate('userId', 'name email role');

        res.json(emails);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get trash emails
// @route   GET /api/email/trash
// @access  Private
router.get('/trash', protect, async (req, res) => {
    try {
        const { search, filterUser } = req.query;
        let query = { isTrash: true };

        const isAdmin = ['master', 'admin', 'manager'].includes(req.user.role);

        if (!isAdmin) {
            query.userId = req.user._id;
        } else if (filterUser && filterUser !== 'all') {
            query.userId = filterUser;
        }

        if (search) {
            query.$or = [
                { subject: { $regex: search, $options: 'i' } },
                { from: { $regex: search, $options: 'i' } },
                { to: { $regex: search, $options: 'i' } },
                { text: { $regex: search, $options: 'i' } }
            ];
        }

        const emails = await Email.find(query)
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('leadId', 'name phone email company')
            .populate('userId', 'name email role');

        res.json(emails);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get single email details
// @route   GET /api/email/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const email = await Email.findById(req.params.id)
            .populate('leadId', 'name phone email company status')
            .populate('userId', 'name email role');

        if (!email) {
            return res.status(404).json({ message: 'Email not found' });
        }

        const isAdmin = ['master', 'admin', 'manager'].includes(req.user.role);
        if (!isAdmin && email.userId && email.userId._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied: You do not have permission to view this email' });
        }

        res.json(email);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Mark email as read
// @route   PUT /api/email/:id/read
// @access  Private
router.put('/:id/read', protect, async (req, res) => {
    try {
        const email = await Email.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
        res.json(email);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Mark email as unread
// @route   PUT /api/email/:id/unread
// @access  Private
router.put('/:id/unread', protect, async (req, res) => {
    try {
        const email = await Email.findByIdAndUpdate(req.params.id, { isRead: false }, { new: true });
        res.json(email);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Toggle star on email
// @route   PUT /api/email/:id/star
// @access  Private
router.put('/:id/star', protect, async (req, res) => {
    try {
        const email = await Email.findById(req.params.id);
        if (!email) return res.status(404).json({ message: 'Email not found' });
        email.isStarred = !email.isStarred;
        await email.save();
        res.json({ success: true, isStarred: email.isStarred, email });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Move email to Spam
// @route   PUT /api/email/:id/spam
// @access  Private
router.put('/:id/spam', protect, async (req, res) => {
    try {
        const email = await Email.findByIdAndUpdate(req.params.id, { 
            folder: 'spam', 
            isSpam: true, 
            isTrash: false 
        }, { new: true });
        res.json({ success: true, message: 'Email moved to Spam', email });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Restore email from Spam to Inbox
// @route   PUT /api/email/:id/unspam
// @access  Private
router.put('/:id/unspam', protect, async (req, res) => {
    try {
        const email = await Email.findByIdAndUpdate(req.params.id, { 
            folder: 'inbox', 
            isSpam: false, 
            isTrash: false 
        }, { new: true });
        res.json({ success: true, message: 'Email moved to Inbox', email });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Move email to Trash
// @route   PUT /api/email/:id/trash
// @access  Private
router.put('/:id/trash', protect, async (req, res) => {
    try {
        const email = await Email.findByIdAndUpdate(req.params.id, { 
            folder: 'trash', 
            isTrash: true 
        }, { new: true });
        res.json({ success: true, message: 'Email moved to Trash', email });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Restore email from Trash
// @route   PUT /api/email/:id/restore
// @access  Private
router.put('/:id/restore', protect, async (req, res) => {
    try {
        const existing = await Email.findById(req.params.id);
        if (!existing) return res.status(404).json({ message: 'Email not found' });

        const targetFolder = existing.direction === 'outbound' ? 'sent' : (existing.isSpam ? 'spam' : 'inbox');
        existing.isTrash = false;
        existing.folder = targetFolder;
        await existing.save();

        res.json({ success: true, message: `Email restored to ${targetFolder}`, email: existing });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Send outbound email with user's personal credentials
// @route   POST /api/email/send
// @access  Private
router.post('/send', protect, async (req, res) => {
    const { to, subject, html, text, leadId } = req.body;

    if (!to || !subject || (!html && !text)) {
        return res.status(400).json({ message: 'Recipient (to), subject, and body are required' });
    }

    try {
        // Send through user's personal configured credentials
        const sendResult = await sendDirectClientEmail(to, subject, html || text, req.user._id);

        // Record outbound email stamped with req.user._id
        const newEmail = await Email.create({
            from: sendResult.sender,
            fromName: req.user.name,
            to: to.trim().toLowerCase(),
            subject,
            text: text || (html ? html.replace(/<[^>]+>/g, ' ') : ''),
            html: html || `<p>${text.replace(/\n/g, '<br/>')}</p>`,
            direction: 'outbound',
            folder: 'sent',
            isTrash: false,
            leadId: leadId || null,
            userId: req.user._id,
            isRead: true
        });

        // If leadId provided, log activity
        if (leadId) {
            try {
                const lead = await Lead.findById(leadId);
                if (lead) {
                    lead.activity.push({
                        description: `Sent Email (${req.user.name}): "${subject.substring(0, 40)}"`,
                        timestamp: new Date()
                    });
                    await lead.save();
                }
            } catch (err) {}
        }

        const io = req.app.get('io');
        if (io) {
            io.emit('email_sent', newEmail);
        }

        res.status(201).json({ success: true, message: 'Email sent successfully!', email: newEmail });
    } catch (error) {
        console.error('[EMAIL SEND ERROR]', error);
        res.status(500).json({ message: error.message || 'Failed to send email' });
    }
});

// @desc    Permanently delete an email
// @route   DELETE /api/email/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const email = await Email.findById(req.params.id);
        if (!email) {
            return res.status(404).json({ message: 'Email not found' });
        }

        const isAdmin = ['master', 'admin', 'manager'].includes(req.user.role);
        if (!isAdmin && email.userId && email.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied: Cannot delete other users emails' });
        }

        await Email.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Email permanently deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
