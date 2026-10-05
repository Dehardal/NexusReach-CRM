const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Lead = require('../models/Lead');
const { protect, authorize } = require('../middleware/auth');

const EmailSettings = require('../models/EmailSettings');
const { encrypt } = require('../utils/crypto');

// Generate JWT token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'prits_crm_secret_key_9026_admin', {
        expiresIn: '30d'
    });
};

// @desc    Register a new sales user & auto-provision domain mailbox (Admin/Master only)
// @route   POST /api/auth/sales
// @access  Private/Master, Admin
router.post('/sales', protect, authorize('master', 'admin'), async (req, res) => {
    const { 
        name, 
        email, 
        password, 
        designation, 
        role,
        domainEmail, 
        mailboxPassword, 
        mailboxProvider,
        assignedAdmin
    } = req.body;

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists with this login email' });
        }

        // If an Admin creates a rep/mail_pedia, default assignedAdmin to that admin if not specified
        const effectiveAdmin = assignedAdmin || (req.user.role === 'admin' ? req.user._id : undefined);

        const user = await User.create({
            name,
            email,
            password,
            designation,
            role: role || 'sales',
            assignedAdmin: effectiveAdmin
        });

        // Auto-provision Domain Mailbox (Cloudflare + Gmail/Custom SMTP)
        const effectiveDomainEmail = (domainEmail && domainEmail.trim().toLowerCase()) || email.trim().toLowerCase();
        let mailboxConfigured = false;

        try {
            let encryptedPass = '';
            let provider = mailboxProvider || 'gmail';
            let smtpHost = 'smtp.gmail.com';
            let smtpPort = 587;
            let smtpUser = effectiveDomainEmail;

            // Option A: Admin provided an explicit App Password / Key for this rep
            if (mailboxPassword && mailboxPassword.trim()) {
                encryptedPass = encrypt(mailboxPassword.trim());
                mailboxConfigured = true;
            } else {
                // Option B: Inherit Organization Master SMTP credentials
                const masterSettings = await EmailSettings.findOne({ isConfigured: true }).sort({ createdAt: 1 });
                if (masterSettings && masterSettings.emailPass) {
                    encryptedPass = masterSettings.emailPass; // already encrypted with AES-256
                    provider = masterSettings.provider || 'gmail';
                    smtpHost = masterSettings.smtpHost || 'smtp.gmail.com';
                    smtpPort = masterSettings.smtpPort || 587;
                    smtpUser = masterSettings.smtpUser || masterSettings.emailUser;
                    mailboxConfigured = true;
                } else if (process.env.EMAIL_PASS && process.env.EMAIL_PASS !== 'testpass') {
                    encryptedPass = encrypt(process.env.EMAIL_PASS);
                    provider = 'gmail';
                    smtpUser = process.env.EMAIL_USER || effectiveDomainEmail;
                    mailboxConfigured = true;
                }
            }

            // Always create the EmailSettings record so incoming Cloudflare routing maps directly to this user
            await EmailSettings.findOneAndUpdate(
                { userId: user._id },
                {
                    userId: user._id,
                    senderName: user.name,
                    emailUser: effectiveDomainEmail,
                    smtpUser: smtpUser || effectiveDomainEmail,
                    emailPass: encryptedPass || encrypt('default_smtp_placeholder'),
                    provider,
                    smtpHost,
                    smtpPort,
                    isConfigured: mailboxConfigured
                },
                { upsert: true, new: true }
            );
            console.log(`[AUTO-PROVISION] Domain mailbox created for ${user.name} (${effectiveDomainEmail})`);
        } catch (provisionErr) {
            console.warn('[AUTO-PROVISION WARNING] Failed to auto-provision mailbox:', provisionErr.message);
        }

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            designation: user.designation,
            domainEmail: effectiveDomainEmail,
            mailboxConfigured,
            assignedAdmin: user.assignedAdmin
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            designation: user.designation,
            token: generateToken(user._id)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
    res.json(req.user);
});

// @desc    Get all active team members (Admins, Sales, Mail Pedia)
// @route   GET /api/auth/sales
// @access  Private/Master, Admin, Manager
router.get('/sales', protect, authorize('master', 'admin', 'manager'), async (req, res) => {
    try {
        let filter = { role: { $ne: 'master' } };
        // If logged-in user is admin (and not master), show team members in their department or unassigned
        if (req.user.role === 'admin') {
            filter = {
                $or: [
                    { assignedAdmin: req.user._id },
                    { assignedAdmin: { $exists: false } },
                    { assignedAdmin: null },
                    { _id: req.user._id }
                ]
            };
        }

        const users = await User.find(filter).populate('assignedAdmin', 'name email');
        const userIds = users.map(u => u._id);
        const settings = await EmailSettings.find({ userId: { $in: userIds } });

        const repsWithMailbox = users.map(u => {
            const userSetting = settings.find(s => s.userId.toString() === u._id.toString());
            return {
                _id: u._id,
                name: u.name,
                email: u.email,
                role: u.role,
                designation: u.designation,
                assignedAdmin: u.assignedAdmin,
                domainEmail: userSetting?.emailUser || u.email,
                mailboxConfigured: !!(userSetting && userSetting.isConfigured),
                mailboxProvider: userSetting?.provider || 'none'
            };
        });

        res.json(repsWithMailbox);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all available admins for assignment dropdowns
// @route   GET /api/auth/admins
// @access  Private/Master, Admin
router.get('/admins', protect, authorize('master', 'admin'), async (req, res) => {
    try {
        const admins = await User.find({ role: { $in: ['admin', 'master'] } }).select('name email role');
        res.json(admins);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all active users/team members for mailbox assignment
// @route   GET /api/auth/users-list
// @access  Private/Master, Admin
router.get('/users-list', protect, authorize('master', 'admin'), async (req, res) => {
    try {
        const users = await User.find({}, '_id name email role designation').sort({ name: 1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Update a team member & their domain mailbox / assigned admin
// @route   PUT /api/auth/sales/:id
// @access  Private/Master, Admin
router.put('/sales/:id', protect, authorize('master', 'admin'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        user.designation = req.body.designation || user.designation;
        user.role = req.body.role || user.role;
        if (req.body.assignedAdmin !== undefined) {
            user.assignedAdmin = req.body.assignedAdmin || null;
        }

        if (req.body.password) {
            user.password = req.body.password;
        }

        const updatedUser = await user.save();

        // Update Domain Mailbox if provided
        if (req.body.domainEmail || req.body.mailboxPassword) {
            const updateFields = {};
            if (req.body.domainEmail) updateFields.emailUser = req.body.domainEmail.trim().toLowerCase();
            if (req.body.name) updateFields.senderName = req.body.name;
            if (req.body.mailboxPassword && req.body.mailboxPassword.trim()) {
                updateFields.emailPass = encrypt(req.body.mailboxPassword.trim());
                updateFields.isConfigured = true;
            }
            await EmailSettings.findOneAndUpdate(
                { userId: user._id },
                { $set: updateFields },
                { upsert: true }
            );
        }

        const populatedUser = await User.findById(updatedUser._id).populate('assignedAdmin', 'name email');

        res.json({
            _id: populatedUser._id,
            name: populatedUser.name,
            email: populatedUser.email,
            role: populatedUser.role,
            designation: populatedUser.designation,
            assignedAdmin: populatedUser.assignedAdmin
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Delete a sales user & their domain mailbox
// @route   DELETE /api/auth/sales/:id
// @access  Private/Master, Admin
router.delete('/sales/:id', protect, authorize('master', 'admin'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await user.deleteOne();
        await EmailSettings.deleteOne({ userId: user._id });

        res.json({ message: 'User and linked mailbox removed successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get dashboard metrics & stats
// @route   GET /api/auth/stats/overview
// @access  Private
router.get('/stats/overview', protect, async (req, res) => {
    try {
        const leadQuery = req.user.role === 'sales' ? { assignedTo: req.user._id } : {};

        const totalLeads = await Lead.countDocuments(leadQuery);
        const hotLeads = await Lead.countDocuments({ ...leadQuery, aiScore: 'Hot' });
        const enrolledLeads = await Lead.countDocuments({ ...leadQuery, status: 'Enrolled' });
        const wonLeads = await Lead.countDocuments({ ...leadQuery, status: 'Won' });
        
        // Follow-ups today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const followupsToday = await Lead.countDocuments({
            ...leadQuery,
            'followUp.date': { $gte: startOfDay, $lte: endOfDay }
        });

        // Revenue & Outreach calculations
        const leadsData = await Lead.find(leadQuery, { 
            feesCollected: 1, 
            totalAmount: 1,
            whatsappMessages: 1,
            activity: 1
        });
        
        let totalRevenue = 0;
        let expectedRevenue = 0;
        let whatsappSent = 0;
        let whatsappReceived = 0;
        let emailOutreachCount = 0;

        leadsData.forEach(l => {
            totalRevenue += (l.feesCollected || 0);
            expectedRevenue += (l.totalAmount || 0);

            // Aggregate WhatsApp communications
            if (l.whatsappMessages && l.whatsappMessages.length > 0) {
                l.whatsappMessages.forEach(msg => {
                    if (msg.sender === 'sales') whatsappSent++;
                    else if (msg.sender === 'lead') whatsappReceived++;
                });
            }

            // Aggregate email outreach actions
            if (l.activity && l.activity.length > 0) {
                l.activity.forEach(act => {
                    if (act.description && act.description.toLowerCase().includes('sent email')) {
                        emailOutreachCount++;
                    }
                });
            }
        });

        res.json({
            totalLeads,
            hotLeads,
            followupsToday,
            conversionRate: totalLeads > 0 ? ((enrolledLeads + wonLeads) / totalLeads * 100).toFixed(1) : 0,
            totalRevenue,
            expectedRevenue,
            whatsappSent,
            whatsappReceived,
            emailOutreachCount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
