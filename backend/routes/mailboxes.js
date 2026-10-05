const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const Mailbox = require('../models/Mailbox');
const User = require('../models/User');
const Email = require('../models/Email');
const Lead = require('../models/Lead');
const { protect, authorize } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');
const hostingerMailService = require('../services/hostingerMailService');

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Helper to verify SMTP credentials
const verifySmtpConnection = async (host, port, secure, user, pass) => {
    const transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Boolean(secure),
        auth: { user, pass },
        connectionTimeout: 8000,
        greetingTimeout: 8000
    });
    await transporter.verify();
    return true;
};

// @desc    Get all connected mailboxes for the current user (or all if master/admin)
// @route   GET /api/mailboxes
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        let filter = {};

        if (req.user.role === 'master') {
            if (req.query.assignedTo) {
                if (req.query.assignedTo === 'unassigned') {
                    filter.assignedTo = null;
                } else {
                    filter.assignedTo = req.query.assignedTo;
                }
            } else if (req.query.userId) {
                filter.userId = req.query.userId;
            }
        } else {
            // Admin, Sales, Mail Pedia can ONLY view mailboxes assigned to them or created by them
            filter = {
                $or: [
                    { userId: req.user._id },
                    { assignedTo: req.user._id }
                ]
            };
        }

        const mailboxes = await Mailbox.find(filter)
            .populate('userId', 'name email role')
            .populate('assignedTo', 'name email role')
            .sort({ createdAt: -1 });

        // Never expose raw passwords
        const safeMailboxes = mailboxes.map(m => {
            const obj = m.toObject();
            delete obj.emailPass;
            return obj;
        });

        res.json(safeMailboxes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Add a new Hostinger/Custom Mailbox
// @route   POST /api/mailboxes
// @access  Private
router.post('/', protect, async (req, res) => {
    const {
        senderName,
        emailUser,
        emailPass,
        provider = 'hostinger',
        smtpHost = 'smtp.hostinger.com',
        smtpPort = 465,
        smtpSecure = true,
        imapHost = 'imap.hostinger.com',
        imapPort = 993,
        dailyLimit = 100
    } = req.body;

    if (!emailUser || !emailPass) {
        return res.status(400).json({ message: 'Email address and password are required' });
    }

    const cleanEmail = emailUser.trim().toLowerCase();

    try {
        const existing = await Mailbox.findOne({ userId: req.user._id, emailUser: cleanEmail });
        if (existing) {
            return res.status(400).json({ message: `Mailbox ${cleanEmail} is already connected to your account` });
        }

        // Test SMTP connection live
        let connectionVerified = false;
        let testError = '';
        try {
            await verifySmtpConnection(
                smtpHost,
                smtpPort,
                Number(smtpPort) === 465 || smtpSecure,
                cleanEmail,
                emailPass.trim()
            );
            connectionVerified = true;
        } catch (testErr) {
            console.warn(`[MAILBOX TEST WARNING] Failed initial connection to ${cleanEmail}:`, testErr.message);
            testError = testErr.message;
        }

        const encryptedPass = encrypt(emailPass.trim());

        const mailbox = await Mailbox.create({
            userId: req.user._id,
            senderName: senderName || cleanEmail.split('@')[0],
            emailUser: cleanEmail,
            emailPass: encryptedPass,
            provider,
            smtpHost,
            smtpPort: Number(smtpPort),
            smtpSecure: Number(smtpPort) === 465 || smtpSecure,
            imapHost,
            imapPort: Number(imapPort),
            imapSecure: true,
            dailyLimit: Number(dailyLimit) || 100,
            status: connectionVerified ? 'active' : 'error',
            lastError: connectionVerified ? '' : `SMTP Verification Failed: ${testError}`
        });

        const safeObj = mailbox.toObject();
        delete safeObj.emailPass;

        res.status(201).json({
            success: true,
            message: connectionVerified 
                ? `✓ Hostinger mailbox connected & verified successfully` 
                : `⚠️ Mailbox saved but verification warned: ${testError}`,
            mailbox: safeObj,
            verified: connectionVerified
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get Hostinger Agentic Mail API integration status
// @route   GET /api/mailboxes/hostinger-api-status
// @access  Private
router.get('/hostinger-api-status', protect, (req, res) => {
    const key = (process.env.HOSTINGER_MAIL_API_KEY || '').trim();
    const masked = key ? (key.slice(0, 5) + '••••••••' + key.slice(-4)) : '';
    res.json({
        configured: Boolean(key),
        maskedKey: masked,
        domain: process.env.HOSTINGER_DOMAIN || 'risegrowthgroup.com'
    });
});

// @desc    Save & verify Hostinger Agentic Mail API Key
// @route   POST /api/mailboxes/save-api-key
// @access  Private
router.post('/save-api-key', protect, async (req, res) => {
    const { apiKey, domain = 'risegrowthgroup.com' } = req.body;
    if (!apiKey || !apiKey.trim()) {
        return res.status(400).json({ message: 'API key token is required' });
    }

    try {
        const cleanKey = apiKey.trim();
        const testRes = await hostingerMailService.testConnection(cleanKey);

        process.env.HOSTINGER_MAIL_API_KEY = cleanKey;
        process.env.HOSTINGER_DOMAIN = domain.trim();

        const envPath = path.join(__dirname, '../.env');
        if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');
            if (envContent.includes('HOSTINGER_MAIL_API_KEY=')) {
                envContent = envContent.replace(/HOSTINGER_MAIL_API_KEY=.*/g, `HOSTINGER_MAIL_API_KEY=${cleanKey}`);
            } else {
                envContent += `\nHOSTINGER_MAIL_API_KEY=${cleanKey}`;
            }
            if (envContent.includes('HOSTINGER_DOMAIN=')) {
                envContent = envContent.replace(/HOSTINGER_DOMAIN=.*/g, `HOSTINGER_DOMAIN=${domain.trim()}`);
            } else {
                envContent += `\nHOSTINGER_DOMAIN=${domain.trim()}`;
            }
            fs.writeFileSync(envPath, envContent, 'utf8');
        }

        res.json({
            success: true,
            message: '✓ Hostinger Agentic Mail API Key saved and verified successfully!',
            testData: testRes.data
        });
    } catch (err) {
        res.status(400).json({ message: `API Verification Failed: ${err.message}` });
    }
});

// @desc    Sync all mailboxes directly from Hostinger Agentic Mail API
// @route   POST /api/mailboxes/sync-hostinger-api
// @access  Private
router.post('/sync-hostinger-api', protect, async (req, res) => {
    try {
        const apiKey = (req.body.apiKey || process.env.HOSTINGER_MAIL_API_KEY || '').trim();
        if (!apiKey) {
            return res.status(400).json({ message: 'No Hostinger API Key configured. Please enter your API token first.' });
        }

        const syncResult = await hostingerMailService.syncMailboxesToDatabase({
            userId: req.user._id,
            customApiKey: apiKey,
            defaultLimit: Number(req.body.defaultLimit) || 500
        });

        res.json({
            success: true,
            message: syncResult.message,
            stats: syncResult
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @desc    1-Click Activate the 199 created mailboxes from Excel
// @route   POST /api/mailboxes/import-199-premade
// @access  Private
router.post('/import-199-premade', protect, async (req, res) => {
    try {
        const excelPath = path.join(__dirname, '../../1000_risegrowthgroup_emails.xlsx');
        if (!fs.existsSync(excelPath)) {
            return res.status(404).json({ message: '1000_risegrowthgroup_emails.xlsx file not found on server.' });
        }

        const wb = xlsx.readFile(excelPath);
        const allRows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        
        const countToImport = Math.min(Number(req.body.count) || 199, allRows.length);
        const targetRows = allRows.slice(0, countToImport);

        let createdCount = 0;
        let updatedCount = 0;

        for (const row of targetRows) {
            const email = (row.email || '').trim().toLowerCase();
            const password = (row.password || '').trim();
            const name = (row.senderName || row.username || email.split('@')[0]).trim();

            if (!email || !password) continue;

            const existing = await Mailbox.findOne({ userId: req.user._id, emailUser: email });
            const encryptedPass = encrypt(password);

            if (existing) {
                existing.emailPass = encryptedPass;
                existing.senderName = name;
                existing.dailyLimit = 500;
                existing.status = 'active';
                existing.lastError = '';
                await existing.save();
                updatedCount++;
            } else {
                await Mailbox.create({
                    userId: req.user._id,
                    senderName: name,
                    emailUser: email,
                    emailPass: encryptedPass,
                    provider: 'hostinger',
                    smtpHost: 'smtp.hostinger.com',
                    smtpPort: 465,
                    smtpSecure: true,
                    imapHost: 'imap.hostinger.com',
                    imapPort: 993,
                    imapSecure: true,
                    dailyLimit: 500,
                    status: 'active'
                });
                createdCount++;
            }
        }

        res.json({
            success: true,
            message: `✓ Successfully activated ${countToImport} Hostinger mailboxes in CRM (${createdCount} added, ${updatedCount} updated)!`,
            stats: { total: countToImport, created: createdCount, updated: updatedCount }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @desc    Assign or unassign Hostinger mailboxes to a specific user (Admin / Mail Pedia)
// @route   POST /api/mailboxes/assign
// @access  Private (Master only)
router.post('/assign', protect, authorize('master', 'admin'), async (req, res) => {
    try {
        const { mailboxIds, targetUserId } = req.body;

        if (!Array.isArray(mailboxIds) || mailboxIds.length === 0) {
            return res.status(400).json({ message: 'Please select at least one mailbox to assign.' });
        }

        let assignedUserName = 'Unassigned';
        let updateValue = null;

        if (targetUserId && targetUserId !== 'unassign' && targetUserId !== 'none') {
            const targetUser = await User.findById(targetUserId);
            if (!targetUser) {
                return res.status(404).json({ message: 'Target user not found.' });
            }
            assignedUserName = targetUser.name + ` (${targetUser.email})`;
            updateValue = targetUser._id;
        }

        const result = await Mailbox.updateMany(
            { _id: { $in: mailboxIds } },
            { $set: { assignedTo: updateValue } }
        );

        res.json({
            success: true,
            message: `✓ Assigned ${result.modifiedCount} mailboxes to: ${assignedUserName}`,
            modifiedCount: result.modifiedCount,
            targetUserId: updateValue
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @desc    Sync received messages from Hostinger Agentic Mail API for accessible mailboxes
// @route   POST /api/mailboxes/sync-inbox
// @access  Private
router.post('/sync-inbox', protect, async (req, res) => {
    try {
        const apiKey = process.env.HOSTINGER_MAIL_API_KEY;
        if (!apiKey) {
            return res.status(400).json({ message: 'Hostinger API Key not configured in .env' });
        }

        // Find mailboxes accessible to this user
        let filter = { isApiManaged: true, mailboxResourceId: { $ne: '' } };
        if (req.user.role !== 'master') {
            filter.$or = [{ userId: req.user._id }, { assignedTo: req.user._id }];
        }

        const mailboxes = await Mailbox.find(filter);
        let totalSynced = 0;
        const io = req.app.get('io');

        for (const mb of mailboxes) {
            try {
                // Fetch recent inbox messages from Hostinger API
                const url = `https://api.mail.hostinger.com/api/v1/mailboxes/${encodeURIComponent(mb.mailboxResourceId)}/folders/INBOX/messages?perPage=25`;
                const resp = await axios.get(url, {
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
                    timeout: 8000
                });

                const messages = resp.data?.data || [];
                for (const msg of messages) {
                    const messageId = msg.id || msg.uid || `msg-${Date.now()}`;
                    const fromAddr = (msg.from || msg.sender || '').trim();
                    const cleanFrom = (fromAddr.match(/<([^>]+)>/) ? fromAddr.match(/<([^>]+)>/)[1] : fromAddr).toLowerCase();

                    // Check if already in Email collection
                    const exists = await Email.findOne({
                        to: mb.emailUser,
                        $or: [{ messageId: String(messageId) }, { subject: msg.subject, from: cleanFrom }]
                    });

                    if (!exists && cleanFrom) {
                        // Check if from a lead
                        const matchedLead = await Lead.findOne({ email: cleanFrom });
                        if (matchedLead) {
                            matchedLead.campaignStatus = 'replied';
                            matchedLead.status = 'Hot';
                            matchedLead.activity.push({
                                description: `Received reply email from ${cleanFrom} to ${mb.emailUser}: "${msg.subject || 'No Subject'}"`,
                                timestamp: new Date()
                            });
                            await matchedLead.save();
                        }

                        await Email.create({
                            from: cleanFrom,
                            fromName: fromAddr.replace(/<[^>]+>/, '').trim() || cleanFrom,
                            to: mb.emailUser,
                            subject: msg.subject || '(No Subject)',
                            text: msg.snippet || msg.text || '',
                            html: msg.html || `<p>${msg.snippet || ''}</p>`,
                            direction: 'inbound',
                            folder: 'inbox',
                            leadId: matchedLead ? matchedLead._id : null,
                            userId: mb.assignedTo || mb.userId,
                            isRead: false,
                            messageId: String(messageId)
                        });

                        totalSynced++;
                        if (io) {
                            io.emit('new_email', {
                                to: mb.emailUser,
                                from: cleanFrom,
                                subject: msg.subject
                            });
                        }
                    }
                }
            } catch (mbErr) {
                console.warn(`[SYNC INBOX WARNING] ${mb.emailUser}:`, mbErr.message);
            }
        }

        res.json({
            success: true,
            message: `Checked ${mailboxes.length} Hostinger inboxes. Synced ${totalSynced} new incoming messages.`,
            totalSynced
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @desc    Download sample Excel template for bulk mailboxes
// @route   GET /api/mailboxes/template/excel
// @access  Private
router.get('/template/excel', protect, (req, res) => {
    try {
        const sampleData = [
            {
                email: 'outreach1@yourdomain.com',
                password: 'HostingerPassword1',
                senderName: 'Admissions Desk 1',
                dailyLimit: 500,
                smtpHost: 'smtp.hostinger.com',
                smtpPort: 465
            },
            {
                email: 'outreach2@yourdomain.com',
                password: 'HostingerPassword2',
                senderName: 'Admissions Desk 2',
                dailyLimit: 500,
                smtpHost: 'smtp.hostinger.com',
                smtpPort: 465
            },
            {
                email: 'counselor@yourdomain.com',
                password: 'HostingerPassword3',
                senderName: 'Senior Counselor',
                dailyLimit: 400,
                smtpHost: 'smtp.hostinger.com',
                smtpPort: 465
            }
        ];
        const ws = xlsx.utils.json_to_sheet(sampleData);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Mailboxes');
        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', 'attachment; filename="Hostinger_Mailboxes_Template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (err) {
        res.status(500).json({ message: 'Error generating template: ' + err.message });
    }
});

// @desc    Bulk import mailboxes via Excel / CSV upload or direct text paste
// @route   POST /api/mailboxes/bulk-import
// @access  Private
router.post('/bulk-import', protect, upload.single('file'), async (req, res) => {
    try {
        let entries = [];

        // 1. If an Excel/CSV file was uploaded
        if (req.file) {
            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

            entries = rawRows.map(row => {
                const getVal = (...keys) => {
                    const rowKeys = Object.keys(row);
                    for (const k of keys) {
                        const match = rowKeys.find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim() || rk.toLowerCase().replace(/[^a-z0-9]/g, '') === k.toLowerCase().replace(/[^a-z0-9]/g, ''));
                        if (match && row[match] !== undefined && row[match] !== null && String(row[match]).trim() !== '') {
                            return String(row[match]).trim();
                        }
                    }
                    return '';
                };

                return {
                    email: getVal('email', 'emailuser', 'address', 'mail', 'username'),
                    password: getVal('password', 'pass', 'mailpassword', 'key'),
                    senderName: getVal('sendername', 'sender', 'name', 'displayname'),
                    dailyLimit: getVal('dailylimit', 'limit', 'quota'),
                    smtpHost: getVal('smtphost', 'host'),
                    smtpPort: getVal('smtpport', 'port')
                };
            });
        }
        // 2. If raw text / copy-pasted lines were submitted
        else if (req.body.textData) {
            const lines = req.body.textData.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            for (const line of lines) {
                if (line.startsWith('#') || line.startsWith('//')) continue;

                let parts = [];
                if (line.includes(':') && !line.includes(',')) {
                    parts = line.split(':').map(p => p.trim());
                } else if (line.includes(',')) {
                    parts = line.split(',').map(p => p.trim());
                } else if (line.includes('|')) {
                    parts = line.split('|').map(p => p.trim());
                } else if (line.includes('\t')) {
                    parts = line.split('\t').map(p => p.trim());
                }

                if (parts.length >= 2) {
                    entries.push({
                        email: parts[0],
                        password: parts[1],
                        senderName: parts[2] || '',
                        dailyLimit: parts[3] || 500,
                        smtpHost: parts[4] || 'smtp.hostinger.com',
                        smtpPort: parts[5] || 465
                    });
                }
            }
        } else if (Array.isArray(req.body.entries)) {
            entries = req.body.entries;
        }

        if (entries.length === 0) {
            return res.status(400).json({ message: 'No valid mailbox records found in the uploaded file or text.' });
        }

        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        const errors = [];

        for (const item of entries) {
            const email = (item.email || '').trim().toLowerCase();
            const password = (item.password || '').trim();

            if (!email || !email.includes('@') || !password) {
                skippedCount++;
                continue;
            }

            try {
                const encryptedPass = encrypt(password);
                const limitNum = Number(item.dailyLimit) || 500;
                const host = item.smtpHost || 'smtp.hostinger.com';
                const port = Number(item.smtpPort) || 465;
                const name = item.senderName || email.split('@')[0];

                const existing = await Mailbox.findOne({ userId: req.user._id, emailUser: email });

                if (existing) {
                    existing.emailPass = encryptedPass;
                    existing.senderName = name;
                    existing.dailyLimit = limitNum;
                    existing.smtpHost = host;
                    existing.smtpPort = port;
                    existing.status = 'active';
                    existing.lastError = '';
                    await existing.save();
                    updatedCount++;
                } else {
                    await Mailbox.create({
                        userId: req.user._id,
                        senderName: name,
                        emailUser: email,
                        emailPass: encryptedPass,
                        provider: 'hostinger',
                        smtpHost: host,
                        smtpPort: port,
                        smtpSecure: port === 465,
                        imapHost: 'imap.hostinger.com',
                        imapPort: 993,
                        imapSecure: true,
                        dailyLimit: limitNum,
                        status: 'active'
                    });
                    createdCount++;
                }
            } catch (err) {
                errors.push(`${email}: ${err.message}`);
                skippedCount++;
            }
        }

        res.json({
            success: true,
            message: `Processed ${entries.length} mailboxes: ${createdCount} added, ${updatedCount} updated, ${skippedCount} skipped.`,
            stats: { total: entries.length, created: createdCount, updated: updatedCount, skipped: skippedCount, errors }
        });
    } catch (error) {
        console.error('[BULK IMPORT MAILBOXES ERROR]:', error);
        res.status(500).json({ message: error.message || 'Failed to process bulk mailbox import' });
    }
});

// @desc    Test connection of an existing mailbox
// @route   POST /api/mailboxes/:id/test
// @access  Private
router.post('/:id/test', protect, async (req, res) => {
    try {
        const mailbox = await Mailbox.findById(req.params.id);
        if (!mailbox) {
            return res.status(404).json({ message: 'Mailbox not found' });
        }

        // Only owner, master, or admin can test
        if (mailbox.userId.toString() !== req.user._id.toString() && !['master', 'admin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized to test this mailbox' });
        }

        let verifiedVia = [];
        let decryptedPass = '';
        try {
            decryptedPass = decrypt(mailbox.emailPass);
        } catch (_) {}

        // 1. Test via Hostinger Agentic Mail API if managed
        if (mailbox.isApiManaged || mailbox.mailboxResourceId) {
            try {
                const apiRes = await hostingerMailService.testConnection();
                if (apiRes.success) {
                    verifiedVia.push('Hostinger Agentic Mail API');
                }
            } catch (apiErr) {
                console.warn(`[MAILBOX TEST API WARNING] ${mailbox.emailUser}:`, apiErr.message);
            }
        }

        // 2. Test via direct SMTP
        if (decryptedPass && decryptedPass !== 'HOSTINGER_API_MANAGED') {
            try {
                await verifySmtpConnection(
                    mailbox.smtpHost,
                    mailbox.smtpPort,
                    mailbox.smtpSecure,
                    mailbox.emailUser,
                    decryptedPass
                );
                verifiedVia.push(`SMTP (${mailbox.smtpHost}:${mailbox.smtpPort})`);
            } catch (smtpErr) {
                // If already verified via API, SMTP error is just a notice
                if (verifiedVia.length === 0) {
                    throw smtpErr;
                }
            }
        }

        if (verifiedVia.length === 0) {
            throw new Error('Connection failed: Unable to authenticate via Hostinger API or SMTP credentials.');
        }

        mailbox.status = 'active';
        mailbox.lastError = '';
        await mailbox.save();

        res.json({
            success: true,
            message: `✓ Connection verified for ${mailbox.emailUser} via ${verifiedVia.join(' & ')}`
        });
    } catch (error) {
        try {
            await Mailbox.findByIdAndUpdate(req.params.id, {
                status: 'error',
                lastError: error.message
            });
        } catch (_) {}

        res.status(400).json({
            success: false,
            message: `Connection check failed: ${error.message}`
        });
    }
});

// @desc    Update a mailbox settings or toggle active/paused
// @route   PUT /api/mailboxes/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
    try {
        const mailbox = await Mailbox.findById(req.params.id);
        if (!mailbox) {
            return res.status(404).json({ message: 'Mailbox not found' });
        }

        if (mailbox.userId.toString() !== req.user._id.toString() && !['master', 'admin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (req.body.senderName) mailbox.senderName = req.body.senderName.trim();
        if (req.body.dailyLimit !== undefined) mailbox.dailyLimit = Number(req.body.dailyLimit);
        if (req.body.status) mailbox.status = req.body.status;
        if (req.body.emailPass) {
            mailbox.emailPass = encrypt(req.body.emailPass.trim());
        }

        await mailbox.save();

        const safeObj = mailbox.toObject();
        delete safeObj.emailPass;

        res.json({ success: true, mailbox: safeObj });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Delete a connected mailbox
// @route   DELETE /api/mailboxes/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const mailbox = await Mailbox.findById(req.params.id);
        if (!mailbox) {
            return res.status(404).json({ message: 'Mailbox not found' });
        }

        if (mailbox.userId.toString() !== req.user._id.toString() && !['master', 'admin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await mailbox.deleteOne();
        res.json({ success: true, message: 'Mailbox disconnected successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
