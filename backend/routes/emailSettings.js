const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const EmailSettings = require('../models/EmailSettings');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { getActiveEmailCredentials } = require('../services/emailService');
const { encrypt, decrypt } = require('../utils/crypto');

// @desc    Get active Email integration for current authenticated user
// @route   GET /api/email-settings
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const settings = await EmailSettings.findOne({ userId: req.user._id });

        if (!settings) {
            return res.json({
                isConfigured: false,
                senderName: req.user.name || 'CRM Outreach',
                emailUser: '',
                provider: 'custom',
                smtpHost: 'smtp.resend.com',
                smtpPort: 587,
                hasPass: false,
                source: 'none'
            });
        }

        res.json({
            isConfigured: settings.isConfigured,
            senderName: settings.senderName || req.user.name,
            emailUser: settings.emailUser || '',
            smtpUser: settings.smtpUser || settings.emailUser || '',
            provider: settings.provider || 'custom',
            smtpHost: settings.smtpHost || 'smtp.resend.com',
            smtpPort: settings.smtpPort || 587,
            hasPass: !!settings.emailPass,
            source: 'database'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Save & verify Email credentials for current authenticated user
// @route   POST /api/email-settings
// @access  Private
router.post('/', protect, async (req, res) => {
    try {
        const { senderName, emailUser, smtpUser, emailPass, provider, smtpHost, smtpPort } = req.body;

        if (!emailUser) {
            return res.status(400).json({ message: 'Email address is required' });
        }

        const cleanEmailUser = emailUser.trim().toLowerCase();
        const effectiveSmtpUser = (smtpUser && smtpUser.trim()) || (provider === 'resend' ? 'resend' : cleanEmailUser);

        // Check if updating without changing password
        let existingSettings = await EmailSettings.findOne({ userId: req.user._id });
        let passToVerify = emailPass;

        if (!passToVerify && existingSettings && existingSettings.emailPass) {
            passToVerify = decrypt(existingSettings.emailPass);
        }

        if (!passToVerify) {
            return res.status(400).json({ message: 'Password or API Key is required' });
        }

        // Sanitize App Password by removing any spaces
        if (provider === 'gmail' || cleanEmailUser.includes('gmail.com')) {
            passToVerify = passToVerify.replace(/\s+/g, '');
        }

        if (provider === 'resend' || passToVerify.startsWith('re_')) {
            const axios = require('axios');
            try {
                await axios.get('https://api.resend.com/api-keys', {
                    headers: { 'Authorization': `Bearer ${passToVerify}` },
                    timeout: 8000
                });
            } catch (resendErr) {
                if (resendErr.response?.status === 401) {
                    return res.status(400).json({ message: 'Invalid Resend API Key. Please verify your API Key from resend.com/api-keys.' });
                }
            }
        } else {
            // Test credentials with Nodemailer verify()
            let transporter;
            if (provider === 'gmail' || cleanEmailUser.includes('gmail.com')) {
                const port = Number(smtpPort) || 587;
                transporter = nodemailer.createTransport({
                    host: 'smtp.gmail.com',
                    port: port,
                    secure: port === 465,
                    auth: { user: effectiveSmtpUser, pass: passToVerify },
                    tls: { rejectUnauthorized: false },
                    connectionTimeout: 10000,
                    greetingTimeout: 10000
                });
            } else if (provider === 'brevo') {
                transporter = nodemailer.createTransport({
                    host: 'smtp-relay.brevo.com',
                    port: 587,
                    secure: false,
                    auth: { user: effectiveSmtpUser, pass: passToVerify }
                });
            } else if (provider === 'outlook') {
                transporter = nodemailer.createTransport({
                    host: 'smtp.office365.com',
                    port: 587,
                    secure: false,
                    auth: { user: effectiveSmtpUser, pass: passToVerify }
                });
            } else {
                transporter = nodemailer.createTransport({
                    host: smtpHost || 'smtp.resend.com',
                    port: Number(smtpPort) || 587,
                    secure: Number(smtpPort) === 465,
                    auth: { user: effectiveSmtpUser, pass: passToVerify }
                });
            }

            try {
                await transporter.verify();
            } catch (verifyErr) {
                console.error('[EMAIL SETTINGS VERIFY ERROR]', verifyErr);
                return res.status(400).json({
                    message: `Failed to authenticate with ${provider.toUpperCase()}: ${verifyErr.message}. Note: On cloud platforms like Render Free Tier, SMTP ports 25, 465, and 587 are blocked. Use Resend (HTTPS API) or upgrade instance to enable SMTP.`
                });
            }
        }

        // Encrypt the password before storing in MongoDB
        const encryptedPass = encrypt(passToVerify);

        // Upsert user-specific settings
        const updatedSettings = await EmailSettings.findOneAndUpdate(
            { userId: req.user._id },
            {
                userId: req.user._id,
                senderName: senderName || req.user.name,
                emailUser: cleanEmailUser,
                smtpUser: effectiveSmtpUser,
                emailPass: encryptedPass,
                provider: provider || 'custom',
                smtpHost: smtpHost || 'smtp.resend.com',
                smtpPort: Number(smtpPort) || 587,
                isConfigured: true
            },
            { upsert: true, new: true }
        );

        // Also ensure primary mailbox is present in Mailbox collection
        const Mailbox = require('../models/Mailbox');
        await Mailbox.findOneAndUpdate(
            { userId: req.user._id, emailUser: cleanEmailUser },
            {
                userId: req.user._id,
                senderName: senderName || req.user.name,
                emailUser: cleanEmailUser,
                emailPass: encryptedPass,
                provider: provider || 'custom',
                smtpHost: smtpHost || (provider === 'gmail' ? 'smtp.gmail.com' : 'smtp.resend.com'),
                smtpPort: Number(smtpPort) || (provider === 'gmail' ? 587 : 465),
                smtpSecure: Number(smtpPort) === 465,
                status: 'active'
            },
            { upsert: true, new: true }
        );

        res.json({
            message: 'Email credentials securely encrypted, verified, and synced to Mailbox Hub!',
            settings: {
                senderName: updatedSettings.senderName,
                emailUser: updatedSettings.emailUser,
                provider: updatedSettings.provider,
                isConfigured: true,
                hasPass: true
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Send test email to verify user's personal configuration
// @route   POST /api/email-settings/test
// @access  Private
router.post('/test', protect, async (req, res) => {
    try {
        const creds = await getActiveEmailCredentials(req.user._id);
        if (!creds.user || !creds.pass) {
            return res.status(400).json({ message: 'Email credentials are not configured for your account yet' });
        }

        const transporter = nodemailer.createTransport({
            service: creds.provider === 'gmail' ? 'gmail' : undefined,
            host: creds.provider !== 'gmail' ? creds.host : undefined,
            port: creds.provider !== 'gmail' ? creds.port : undefined,
            secure: creds.port === 465,
            auth: { user: creds.user, pass: creds.pass }
        });

        const testMail = {
            from: { name: creds.name, address: creds.user },
            to: creds.user,
            subject: '⚡ CRM Personal Email Integration Verified',
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #111;">
                    <h2 style="color: #6366f1;">Your Domain Email is Verified!</h2>
                    <p>Your personalized CRM email integration is active and ready to send direct client outreach.</p>
                    <hr/>
                    <p style="font-size: 13px; color: #555;">Sender Account: <strong>${creds.name} &lt;${creds.user}&gt;</strong></p>
                    <p style="font-size: 12px; color: #888;">Authenticated User: ${req.user.name} (${req.user.role})</p>
                </div>
            `
        };

        await transporter.sendMail(testMail);
        res.json({ message: `Test email sent to ${creds.user} successfully!` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get team mailboxes overview (Admin & Master only)
// @route   GET /api/email-settings/team
// @access  Private (Admin / Master)
router.get('/team', protect, async (req, res) => {
    if (!['master', 'admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied: Admin/Master privilege required' });
    }

    try {
        const users = await User.find({}).select('name email role designation');
        const settings = await EmailSettings.find({});

        const teamStatus = users.map(u => {
            const userSetting = settings.find(s => s.userId && s.userId.toString() === u._id.toString());
            return {
                userId: u._id,
                name: u.name,
                loginEmail: u.email,
                role: u.role,
                designation: u.designation,
                domainEmail: userSetting?.emailUser || 'Not Configured',
                provider: userSetting?.provider || 'none',
                isConfigured: !!(userSetting && userSetting.isConfigured),
                updatedAt: userSetting?.updatedAt || null
            };
        });

        res.json(teamStatus);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Bulk sync Cloudflare/domain aliases to Mailbox Hub
// @route   POST /api/email-settings/sync-aliases
// @access  Private
router.post('/sync-aliases', protect, async (req, res) => {
    try {
        const { aliasesText } = req.body;
        if (!aliasesText || typeof aliasesText !== 'string') {
            return res.status(400).json({ message: 'Aliases text or CSV content is required' });
        }

        // Get user's active email credentials
        const settings = await EmailSettings.findOne({ userId: req.user._id });
        if (!settings || !settings.emailPass) {
            return res.status(400).json({ 
                message: 'Please configure and verify your Master Outbound credentials first before syncing aliases.' 
            });
        }

        const lines = aliasesText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const Mailbox = require('../models/Mailbox');

        let createdCount = 0;
        let updatedCount = 0;

        for (const line of lines) {
            // Support: "email" OR "name,email" OR "email,name"
            const parts = line.split(/[,\t]+/).map(p => p.trim().replace(/^["']|["']$/g, ''));
            let email = '';
            let name = '';

            if (parts.length >= 2) {
                if (parts[0].includes('@')) {
                    email = parts[0];
                    name = parts[1];
                } else if (parts[1].includes('@')) {
                    name = parts[0];
                    email = parts[1];
                }
            } else if (parts[0].includes('@')) {
                email = parts[0];
                name = email.split('@')[0].replace(/[._-]/g, ' ');
                name = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            }

            if (!email || !email.includes('@')) continue;

            email = email.toLowerCase().trim();

            const existing = await Mailbox.findOne({ userId: req.user._id, emailUser: email });
            const aliasProvider = (settings.provider === 'gmail' && !email.endsWith('@gmail.com')) ? 'cloudflare' : (settings.provider || 'gmail');
            const authSmtpUser = settings.smtpUser || settings.emailUser;

            if (existing) {
                existing.senderName = name || existing.senderName;
                existing.emailPass = settings.emailPass;
                existing.smtpUser = authSmtpUser;
                existing.provider = aliasProvider;
                existing.smtpHost = settings.smtpHost || (settings.provider === 'gmail' ? 'smtp.gmail.com' : 'smtp.resend.com');
                existing.smtpPort = settings.smtpPort || (settings.provider === 'gmail' ? 587 : 465);
                existing.smtpSecure = Number(settings.smtpPort) === 465;
                existing.status = 'active';
                await existing.save();
                updatedCount++;
            } else {
                await Mailbox.create({
                    userId: req.user._id,
                    senderName: name || email.split('@')[0],
                    emailUser: email,
                    smtpUser: authSmtpUser,
                    emailPass: settings.emailPass,
                    provider: aliasProvider,
                    smtpHost: settings.smtpHost || (settings.provider === 'gmail' ? 'smtp.gmail.com' : 'smtp.resend.com'),
                    smtpPort: settings.smtpPort || (settings.provider === 'gmail' ? 587 : 465),
                    smtpSecure: Number(settings.smtpPort) === 465,
                    dailyLimit: 100,
                    status: 'active'
                });
                createdCount++;
            }
        }

        res.json({
            success: true,
            message: `Successfully registered ${createdCount + updatedCount} domain aliases into Mailbox Hub! (${createdCount} created, ${updatedCount} updated).`,
            stats: { created: createdCount, updated: updatedCount, total: createdCount + updatedCount }
        });
    } catch (err) {
        console.error('[SYNC ALIASES ERROR]', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
