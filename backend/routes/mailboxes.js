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
const { createActivityNotification } = require('./notifications');

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
// @desc    Get all connected mailboxes for current user (or all if master/admin)
// @route   GET /api/mailboxes
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        let filter = {};

        if (['master', 'admin'].includes(req.user.role)) {
            if (req.query.assignedTo) {
                if (req.query.assignedTo === 'unassigned') {
                    filter.assignedTo = null;
                } else {
                    filter.assignedTo = req.query.assignedTo;
                }
            } else if (req.query.userId) {
                filter.userId = req.query.userId;
            }
        } else if (req.user.role === 'mail_pedia') {
            // Mail Pedia can ONLY view mailboxes assigned to them
            filter = { assignedTo: req.user._id };
        } else {
            // Sales reps can NEVER access mailboxes
            return res.status(403).json({ message: 'Access denied: Sales representatives do not have access to mailboxes.' });
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

// @desc    Assign mailboxes (supports hybrid: auto equal distribution + manual split adjustments, or single assign/unassign)
// @route   POST /api/mailboxes/assign
// @access  Private/Master, Admin
router.post('/assign', protect, authorize('master', 'admin'), async (req, res) => {
    try {
        const { mailboxIds, allocations, distributions, assignedTo, targetUserId } = req.body;
        const effectiveAllocations = allocations || distributions;
        const effectiveAssignedTo = assignedTo !== undefined ? assignedTo : targetUserId;

        if (!Array.isArray(mailboxIds) || mailboxIds.length === 0) {
            return res.status(400).json({ message: 'No mailboxes selected for assignment' });
        }

        // Case 1: Unassign all selected mailboxes
        if (effectiveAssignedTo === null && (!effectiveAllocations || effectiveAllocations.length === 0)) {
            const result = await Mailbox.updateMany(
                { _id: { $in: mailboxIds } },
                { $set: { assignedTo: null } }
            );
            return res.json({
                success: true,
                message: `Successfully unassigned ${result.modifiedCount} mailbox(es).`,
                count: result.modifiedCount
            });
        }

        const io = req.app.get('io');

        // Case 2: Multi-user hybrid split distribution (allocations: [{ userId, count }, ...])
        if (Array.isArray(effectiveAllocations) && effectiveAllocations.length > 0) {
            const targetUserIds = effectiveAllocations.map(a => a.userId).filter(Boolean);
            const targetUsers = await User.find({ _id: { $in: targetUserIds } });
            const userMap = new Map(targetUsers.map(u => [u._id.toString(), u]));

            // Strict authorization checks across all targets:
            for (const alloc of effectiveAllocations) {
                const targetUser = userMap.get(alloc.userId.toString());
                if (!targetUser) {
                    return res.status(404).json({ message: `Target user ${alloc.userId} not found` });
                }

                // 1. Sales can NEVER have mailboxes assigned anywhere on the CRM
                if (targetUser.role === 'sales') {
                    return res.status(403).json({ 
                        message: `Authorization Violation: Mailboxes can NEVER be assigned to Sales representatives (${targetUser.name}). Mailboxes can only be assigned to Admin or Mail Pedia.` 
                    });
                }

                // 2. On Admin panel: Admins can ONLY assign to mail_pedia
                if (req.user.role === 'admin' && targetUser.role !== 'mail_pedia') {
                    return res.status(403).json({ 
                        message: `Authorization Violation: Admins can ONLY assign mailboxes to Mail Pedia users. Cannot assign to ${targetUser.name} (${targetUser.role}).` 
                    });
                }

                // 3. Master can assign to admin and mail_pedia
                if (req.user.role === 'master' && !['admin', 'mail_pedia'].includes(targetUser.role)) {
                    return res.status(403).json({ 
                        message: `Authorization Violation: Mailboxes can only be assigned to Admin or Mail Pedia.` 
                    });
                }
            }

            let currentIndex = 0;
            const assignmentResults = [];

            for (const alloc of effectiveAllocations) {
                const count = parseInt(alloc.count, 10);
                if (!count || count <= 0) continue;

                const chunkIds = mailboxIds.slice(currentIndex, currentIndex + count);
                currentIndex += count;

                if (chunkIds.length === 0) break;

                await Mailbox.updateMany(
                    { _id: { $in: chunkIds } },
                    { $set: { assignedTo: alloc.userId } }
                );

                const targetUser = userMap.get(alloc.userId.toString());
                assignmentResults.push({
                    userId: alloc.userId,
                    userName: targetUser.name,
                    assignedCount: chunkIds.length
                });

                // Send real-time notification to the assigned user
                await createActivityNotification({
                    io,
                    recipient: targetUser._id,
                    sender: req.user._id,
                    type: 'mailbox_assigned',
                    title: 'New Mailboxes Assigned',
                    message: `${chunkIds.length} Hostinger mailbox(es) assigned to you by ${req.user.name} (${req.user.role}).`,
                    metadata: { count: chunkIds.length, mailboxIds: chunkIds }
                });
            }

            return res.json({
                success: true,
                message: `Successfully distributed ${currentIndex} mailbox(es) across ${assignmentResults.length} user(s).`,
                results: assignmentResults
            });
        }

        // Case 3: Single user assignment (assignedTo: userId)
        if (effectiveAssignedTo) {
            const targetUser = await User.findById(effectiveAssignedTo);
            if (!targetUser) {
                return res.status(404).json({ message: 'Target user not found' });
            }

            // 1. Sales can NEVER have mailboxes assigned anywhere on the CRM
            if (targetUser.role === 'sales') {
                return res.status(403).json({ 
                    message: `Authorization Violation: Mailboxes can NEVER be assigned to Sales representatives (${targetUser.name}). Mailboxes can only be assigned to Admin or Mail Pedia.` 
                });
            }

            // 2. On Admin panel: Admins can ONLY assign to mail_pedia
            if (req.user.role === 'admin' && targetUser.role !== 'mail_pedia') {
                return res.status(403).json({ 
                    message: `Authorization Violation: Admins can ONLY assign mailboxes to Mail Pedia users. Cannot assign to ${targetUser.name} (${targetUser.role}).` 
                });
            }

            // 3. Master can assign to admin and mail_pedia
            if (req.user.role === 'master' && !['admin', 'mail_pedia'].includes(targetUser.role)) {
                return res.status(403).json({ 
                    message: `Authorization Violation: Mailboxes can only be assigned to Admin or Mail Pedia.` 
                });
            }

            await Mailbox.updateMany(
                { _id: { $in: mailboxIds } },
                { $set: { assignedTo: targetUser._id } }
            );

            await createActivityNotification({
                io,
                recipient: targetUser._id,
                sender: req.user._id,
                type: 'mailbox_assigned',
                title: 'Mailboxes Assigned',
                message: `${mailboxIds.length} Hostinger mailbox(es) assigned to you by ${req.user.name} (${req.user.role}).`,
                metadata: { count: mailboxIds.length, mailboxIds }
            });

            return res.json({
                success: true,
                message: `Successfully assigned ${mailboxIds.length} mailbox(es) to ${targetUser.name}.`,
                assignedTo: { _id: targetUser._id, name: targetUser.name, role: targetUser.role }
            });
        }

        return res.status(400).json({ message: 'Please specify target user(s) or distribution allocations' });
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

// Helper to read latest env on disk (in case .env was modified without restarting node server)
const getHostingerApiKey = () => {
    try {
        const envPath = path.join(__dirname, '../.env');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            const match = content.match(/HOSTINGER_MAIL_API_KEY=(.*)/);
            if (match && match[1]) {
                const key = match[1].trim();
                process.env.HOSTINGER_MAIL_API_KEY = key;
                return key;
            }
        }
    } catch (_) {}
    return (process.env.HOSTINGER_MAIL_API_KEY || '').trim();
};

// @desc    Get Hostinger Agentic Mail API integration status
// @route   GET /api/mailboxes/hostinger-api-status
// @access  Private
router.get('/hostinger-api-status', protect, (req, res) => {
    const key = getHostingerApiKey();
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
        let testRes = null;
        let verifyErr = null;
        try {
            testRes = await hostingerMailService.testConnection(cleanKey);
        } catch (e) {
            verifyErr = e.message;
        }

        const forceSave = Boolean(req.body.forceSave);

        // If verification failed and not forcing save:
        if (verifyErr && !forceSave) {
            return res.status(400).json({ 
                message: `Hostinger Token Rejected: ${verifyErr}`,
                verified: false,
                canForceSave: true
            });
        }

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
            verified: !verifyErr,
            message: verifyErr 
                ? `⚠️ Token saved to .env, but Hostinger reported: ${verifyErr}`
                : '✓ Hostinger Agentic Mail API Key verified and saved successfully!',
            testData: testRes ? testRes.data : null
        });
    } catch (err) {
        res.status(500).json({ message: `API Error: ${err.message}` });
    }
});

// @desc    Sync all mailboxes directly from Hostinger Agentic Mail API
// @route   POST /api/mailboxes/sync-hostinger-api
// @access  Private
router.post('/sync-hostinger-api', protect, async (req, res) => {
    try {
        const apiKey = (req.body.apiKey || getHostingerApiKey() || '').trim();
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

// @desc    Assign or unassign Hostinger mailboxes to a specific user or distribute across multiple users (Equal / Manual)
// @route   POST /api/mailboxes/assign
// @access  Private (Master & Admin)
router.post('/assign', protect, authorize('master', 'admin'), async (req, res) => {
    try {
        const { mailboxIds, targetUserId, distributionMode, distributions, selectedUserIds } = req.body;

        if (!Array.isArray(mailboxIds) || mailboxIds.length === 0) {
            return res.status(400).json({ message: 'Please select at least one mailbox to assign.' });
        }

        // Case 1: Unassign all selected
        if (targetUserId === 'unassign' || targetUserId === 'none') {
            const result = await Mailbox.updateMany(
                { _id: { $in: mailboxIds } },
                { $set: { assignedTo: null } }
            );
            return res.json({
                success: true,
                message: `✓ Unassigned ${result.modifiedCount} mailbox(es). They are now in the Master pool.`,
                modifiedCount: result.modifiedCount
            });
        }

        // --- Role & Authorization Enforcement ---
        // 1. Mailboxes can ONLY be assigned to 'admin' and 'mail_pedia' (NEVER 'sales')
        // 2. On Admin panel: Admins can ONLY assign to 'mail_pedia'
        let targetCheckIds = [];
        if (targetUserId) {
            targetCheckIds.push(targetUserId);
        } else if (Array.isArray(selectedUserIds)) {
            targetCheckIds.push(...selectedUserIds);
        } else if (Array.isArray(distributions)) {
            targetCheckIds.push(...distributions.map(d => d.userId));
        }

        if (targetCheckIds.length > 0) {
            const checkUsers = await User.find({ _id: { $in: targetCheckIds } }, '_id name role designation');
            for (const u of checkUsers) {
                if (u.role === 'sales') {
                    return res.status(403).json({
                        message: `Forbidden: Mailboxes can only be assigned to Mail Pedia and Admin specialists. Cannot assign to Sales representative "${u.name}".`
                    });
                }
                if (req.user.role === 'admin' && u.role !== 'mail_pedia') {
                    return res.status(403).json({
                        message: `Forbidden: As an Admin, you can only assign mailboxes to Mail Pedia specialists. Cannot assign to "${u.name}" (${u.role}).`
                    });
                }
            }
        }

        const io = req.app.get('io');

        // Case 2: Multi-user distribution ('equal')
        if (distributionMode === 'equal' && Array.isArray(selectedUserIds) && selectedUserIds.length > 0) {
            const totalMailboxes = mailboxIds.length;
            const userCount = selectedUserIds.length;
            const baseCount = Math.floor(totalMailboxes / userCount);
            let remainder = totalMailboxes % userCount;

            let startIndex = 0;
            const resultsSummary = [];

            for (let i = 0; i < userCount; i++) {
                const uid = selectedUserIds[i];
                const countForThisUser = baseCount + (remainder > 0 ? 1 : 0);
                if (remainder > 0) remainder--;

                if (countForThisUser > 0 && startIndex < totalMailboxes) {
                    const chunk = mailboxIds.slice(startIndex, startIndex + countForThisUser);
                    startIndex += chunk.length;

                    await Mailbox.updateMany(
                        { _id: { $in: chunk } },
                        { $set: { assignedTo: uid } }
                    );

                    const u = await User.findById(uid, 'name email');
                    resultsSummary.push(`${u?.name || 'User'}: ${chunk.length}`);

                    createActivityNotification({
                        io,
                        recipient: uid,
                        sender: req.user._id,
                        type: 'mailbox_assigned',
                        title: 'Hostinger Mailbox(es) Assigned',
                        message: `${req.user.name} (${req.user.role}) assigned ${chunk.length} Hostinger mailbox(es) to you.`,
                        metadata: { count: chunk.length }
                    });
                }
            }

            return res.json({
                success: true,
                message: `✓ Successfully divided ${totalMailboxes} mailboxes equally among ${userCount} users (${resultsSummary.join(', ')})`,
                modifiedCount: totalMailboxes
            });
        }

        // Case 3: Multi-user distribution ('manual')
        if (distributionMode === 'manual' && Array.isArray(distributions) && distributions.length > 0) {
            let startIndex = 0;
            const resultsSummary = [];
            let totalAssigned = 0;

            for (const dist of distributions) {
                const count = Math.max(0, parseInt(dist.count, 10) || 0);
                if (count > 0 && startIndex < mailboxIds.length) {
                    const chunk = mailboxIds.slice(startIndex, startIndex + count);
                    startIndex += chunk.length;
                    totalAssigned += chunk.length;

                    await Mailbox.updateMany(
                        { _id: { $in: chunk } },
                        { $set: { assignedTo: dist.userId } }
                    );

                    const u = await User.findById(dist.userId, 'name email');
                    resultsSummary.push(`${u?.name || 'User'}: ${chunk.length}`);

                    createActivityNotification({
                        io,
                        recipient: dist.userId,
                        sender: req.user._id,
                        type: 'mailbox_assigned',
                        title: 'Hostinger Mailbox(es) Assigned',
                        message: `${req.user.name} (${req.user.role}) assigned ${chunk.length} Hostinger mailbox(es) to you.`,
                        metadata: { count: chunk.length }
                    });
                }
            }

            return res.json({
                success: true,
                message: `✓ Successfully manually distributed ${totalAssigned} mailboxes (${resultsSummary.join(', ')})`,
                modifiedCount: totalAssigned
            });
        }

        // Case 4: Single user assignment (standard)
        let assignedUserName = 'Unassigned';
        let updateValue = null;

        if (targetUserId) {
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

        if (updateValue) {
            createActivityNotification({
                io,
                recipient: updateValue,
                sender: req.user._id,
                type: 'mailbox_assigned',
                title: 'Hostinger Mailbox(es) Assigned',
                message: `${req.user.name} (${req.user.role}) assigned ${result.modifiedCount} Hostinger mailbox(es) to you.`,
                metadata: { count: result.modifiedCount }
            });
        }

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

                // Also sync Sent folder (for emails sent directly from Hostinger webmail)
                try {
                    const sentUrl = `https://api.mail.hostinger.com/api/v1/mailboxes/${encodeURIComponent(mb.mailboxResourceId)}/folders/Sent/messages?perPage=25`;
                    const sentResp = await axios.get(sentUrl, {
                        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
                        timeout: 8000
                    });

                    const sentMessages = sentResp.data?.data || [];
                    for (const msg of sentMessages) {
                        const messageId = msg.id || msg.uid || `sent-${Date.now()}`;
                        const toAddr = (msg.to || msg.recipient || '').trim();
                        const cleanTo = (toAddr.match(/<([^>]+)>/) ? toAddr.match(/<([^>]+)>/)[1] : toAddr).toLowerCase();

                        const exists = await Email.findOne({
                            from: mb.emailUser,
                            $or: [{ messageId: String(messageId) }, { subject: msg.subject, to: cleanTo }]
                        });

                        if (!exists && cleanTo) {
                            const matchedLead = await Lead.findOne({ email: cleanTo });
                            await Email.create({
                                from: mb.emailUser,
                                fromName: mb.senderName || mb.emailUser,
                                to: cleanTo,
                                subject: msg.subject || '(No Subject)',
                                text: msg.snippet || msg.text || '',
                                html: msg.html || `<p>${msg.snippet || ''}</p>`,
                                direction: 'outbound',
                                folder: 'sent',
                                leadId: matchedLead ? matchedLead._id : null,
                                userId: mb.assignedTo || mb.userId,
                                isRead: true,
                                messageId: String(messageId)
                            });
                            totalSynced++;
                        }
                    }
                } catch (sentFolderErr) {
                    // Ignore if Sent folder has alternate naming
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

// @desc    Bulk update status (active / paused) for selected mailboxes
// @route   PUT /api/mailboxes/bulk-status
// @access  Private
router.put('/bulk-status', protect, async (req, res) => {
    try {
        const { mailboxIds, status } = req.body;
        if (!Array.isArray(mailboxIds) || mailboxIds.length === 0) {
            return res.status(400).json({ message: 'No mailboxes selected for status update' });
        }
        if (!['active', 'paused'].includes(status)) {
            return res.status(400).json({ message: 'Status must be "active" or "paused"' });
        }

        const filter = { _id: { $in: mailboxIds } };
        if (!['master', 'admin'].includes(req.user.role)) {
            filter.userId = req.user._id;
        }

        const updateData = { status };
        if (status === 'active') {
            updateData.lastError = ''; // Clear error when manually activated
        }

        const result = await Mailbox.updateMany(filter, { $set: updateData });

        res.json({
            success: true,
            message: `Updated ${result.modifiedCount} mailbox(es) to ${status === 'active' ? 'Active' : 'Paused'}.`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
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
