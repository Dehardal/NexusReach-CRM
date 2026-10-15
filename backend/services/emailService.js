const nodemailer = require('nodemailer');
const EmailSettings = require('../models/EmailSettings');
const Mailbox = require('../models/Mailbox');
const { decrypt } = require('../utils/crypto');
const axios = require('axios');

// Helper to resolve active credentials for a specific user, or fallback
const getActiveEmailCredentials = async (userId = null) => {
    try {
        let settings = null;
        if (userId) {
            settings = await EmailSettings.findOne({ userId });
        }
        
        // If no user-specific setting, find latest configured setting as system fallback
        if (!settings) {
            settings = await EmailSettings.findOne({ isConfigured: true }).sort({ updatedAt: -1 });
        }
        if (!settings) {
            settings = await EmailSettings.findOne({ emailPass: { $exists: true, $ne: '' } }).sort({ updatedAt: -1 });
        }

        if (settings && settings.emailUser && settings.emailPass) {
            let decryptedPass = settings.emailPass;
            try {
                decryptedPass = decrypt(settings.emailPass);
            } catch (decErr) {
                decryptedPass = settings.emailPass;
            }

            const isGmail = settings.provider === 'gmail' || 
                           (settings.emailUser && settings.emailUser.includes('gmail.com')) ||
                           (settings.smtpHost && settings.smtpHost.includes('gmail.com'));
            if (isGmail && decryptedPass) {
                decryptedPass = decryptedPass.replace(/\s+/g, '');
            }

            return {
                user: settings.emailUser,
                smtpUser: settings.smtpUser || settings.emailUser,
                pass: decryptedPass,
                name: settings.senderName || 'CRM Outreach',
                provider: settings.provider || 'custom',
                host: settings.smtpHost || (isGmail ? 'smtp.gmail.com' : 'smtp.resend.com'),
                port: settings.smtpPort || (isGmail ? 587 : 465)
            };
        }

        // Check configured Mailboxes as secondary fallback
        const fallbackMb = await Mailbox.findOne({ emailPass: { $exists: true, $ne: '' } }).sort({ updatedAt: -1 });
        if (fallbackMb && fallbackMb.emailUser && fallbackMb.emailPass) {
            let decryptedPass = fallbackMb.emailPass;
            try {
                decryptedPass = decrypt(fallbackMb.emailPass);
            } catch (decErr) {
                decryptedPass = fallbackMb.emailPass;
            }

            const isGmail = fallbackMb.provider === 'gmail' || 
                           (fallbackMb.emailUser && fallbackMb.emailUser.includes('gmail.com')) ||
                           (fallbackMb.smtpHost && fallbackMb.smtpHost.includes('gmail.com'));
            if (isGmail && decryptedPass) {
                decryptedPass = decryptedPass.replace(/\s+/g, '');
            }

            return {
                user: fallbackMb.emailUser,
                smtpUser: fallbackMb.smtpUser || fallbackMb.emailUser,
                pass: decryptedPass,
                name: fallbackMb.senderName || 'CRM Outreach',
                provider: fallbackMb.provider || (isGmail ? 'gmail' : 'custom'),
                host: fallbackMb.smtpHost || (isGmail ? 'smtp.gmail.com' : 'smtp.hostinger.com'),
                port: fallbackMb.smtpPort || (isGmail ? 587 : 465)
            };
        }
    } catch (e) {
        console.warn('[EMAIL SERVICE] Could not load user settings, falling back to env:', e.message);
    }

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_PASS !== 'testpass') {
        const pass = process.env.EMAIL_PASS.replace(/\s+/g, '');
        return {
            user: process.env.EMAIL_USER,
            smtpUser: process.env.EMAIL_USER,
            pass: pass,
            name: 'CRM Outreach',
            provider: 'gmail',
            host: 'smtp.gmail.com',
            port: 587
        };
    }

    return null;
};

// Helper to build transport options with strict timeouts
const buildTransportConfig = (creds) => {
    const baseTimeouts = {
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 12000
    };

    if (creds.provider === 'gmail' || (creds.user && creds.user.includes('gmail.com'))) {
        const port = Number(creds.port) || 587;
        return {
            host: 'smtp.gmail.com',
            port: port,
            secure: port === 465,
            auth: {
                user: creds.smtpUser || creds.user,
                pass: creds.pass
            },
            tls: {
                rejectUnauthorized: false
            },
            ...baseTimeouts
        };
    }

    if (creds.provider === 'resend') {
        return {
            host: 'smtp.resend.com',
            port: 465,
            secure: true,
            auth: {
                user: 'resend',
                pass: creds.pass
            },
            ...baseTimeouts
        };
    }

    if (creds.provider === 'brevo') {
        return {
            host: 'smtp-relay.brevo.com',
            port: 587,
            secure: false,
            auth: {
                user: creds.smtpUser || creds.user,
                pass: creds.pass
            },
            ...baseTimeouts
        };
    }

    if (creds.provider === 'outlook') {
        return {
            host: 'smtp.office365.com',
            port: 587,
            secure: false,
            auth: {
                user: creds.smtpUser || creds.user,
                pass: creds.pass
            },
            ...baseTimeouts
        };
    }

    // Default Custom SMTP
    return {
        host: creds.host || 'smtp.resend.com',
        port: Number(creds.port) || 587,
        secure: Number(creds.port) === 465,
        auth: {
            user: creds.smtpUser || creds.user,
            pass: creds.pass
        },
        ...baseTimeouts
    };
};

// Create user-specific or system nodemailer transporter
const createTransporter = async (userId = null) => {
    const creds = await getActiveEmailCredentials(userId);

    if (!creds || !creds.user || !creds.pass || creds.pass === 'testpass') {
        throw new Error('Email integration is not configured for your account. Please configure your email credentials or Google App Password in Email Settings.');
    }

    const transportConfig = buildTransportConfig(creds);
    return {
        transporter: nodemailer.createTransport(transportConfig),
        creds
    };
};

// Send automated follow-up notification email
const sendFollowUpNotification = async (leadData, followUpData, salesPersonName, recipientEmail = null, userId = null) => {
    try {
        const { transporter, creds } = await createTransporter(userId);
        const formattedDate = new Date(followUpData.date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const emailHTML = `
            <h2>Follow-up Scheduled</h2>
            <p>A new follow-up meeting has been scheduled in the CRM by <strong>${salesPersonName}</strong>.</p>
            <hr />
            <p><strong>Lead Name:</strong> ${leadData.name || 'N/A'}</p>
            <p><strong>Phone:</strong> ${leadData.phone || 'N/A'}</p>
            <p><strong>Email:</strong> ${leadData.email || 'N/A'}</p>
            <p><strong>Time:</strong> ${formattedDate} at ${followUpData.time}</p>
            <p><strong>Notes:</strong> ${followUpData.notes || 'No notes.'}</p>
        `;

        const toEmail = recipientEmail || process.env.NOTIFICATION_EMAIL || creds.user;
        if (!toEmail) throw new Error('No recipient email address available.');

        const mailOptions = {
            from: {
                name: creds.name || 'CRM Notification',
                address: creds.user
            },
            to: toEmail,
            subject: `📅 Follow-up: ${leadData.name} - ${formattedDate}`,
            html: emailHTML
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Follow-up email notification sent successfully from ${creds.user}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error sending follow-up notification:', error.message);
        throw error;
    }
};

// Helper to dispatch email via SMTP with automatic dual-port fallback (587 STARTTLS <-> 465 SSL)
const dispatchWithPortFallback = async ({ host, port, authUser, pass, isGmail, mailOptions }) => {
    // If using Resend API Key, dispatch over HTTPS REST API (Port 443) which is never blocked by cloud firewalls
    if ((pass && pass.startsWith('re_')) || (host && host.includes('resend.com'))) {
        try {
            console.log(`🚀 Dispatching email via Resend HTTPS REST API (Port 443)...`);
            const res = await axios.post('https://api.resend.com/emails', {
                from: mailOptions.from,
                to: [mailOptions.to],
                reply_to: mailOptions.replyTo || undefined,
                subject: mailOptions.subject,
                html: mailOptions.html,
                text: mailOptions.text
            }, {
                headers: {
                    'Authorization': `Bearer ${pass}`,
                    'Content-Type': 'application/json'
                },
                timeout: 12000
            });
            console.log(`✅ Resend HTTPS API success:`, res.data);
            return { messageId: res.data?.id };
        } catch (resendApiErr) {
            console.warn('[RESEND HTTPS API WARNING]', resendApiErr.response?.data || resendApiErr.message);
        }
    }

    const primaryPort = isGmail ? (port ? Number(port) : 587) : (Number(port) || 587);
    const primarySecure = primaryPort === 465;

    const createConfig = (p, sec) => ({
        host: host || (isGmail ? 'smtp.gmail.com' : 'smtp.resend.com'),
        port: p,
        secure: sec,
        auth: { user: authUser, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
    });

    const primaryTransporter = nodemailer.createTransport(createConfig(primaryPort, primarySecure));
    try {
        return await primaryTransporter.sendMail(mailOptions);
    } catch (err) {
        const isConnOrTimeout = err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.code === 'ESOCKET' || (err.message && err.message.includes('timeout'));
        if (isConnOrTimeout && isGmail) {
            const fallbackPort = primaryPort === 465 ? 587 : 465;
            console.warn(`[EMAIL SERVICE] Connection timed out on port ${primaryPort}. Retrying automatically via port ${fallbackPort}...`);
            const fallbackTransporter = nodemailer.createTransport(createConfig(fallbackPort, fallbackPort === 465));
            return await fallbackTransporter.sendMail(mailOptions);
        }
        throw err;
    }
};

// Send direct client email (supports Mailbox identities, Cloudflare domain aliases, and user-specific credentials)
const sendDirectClientEmail = async (toEmail, subject, htmlBody, userId = null, customSender = null) => {
    let attemptedSender = customSender || 'your email account';
    try {
        const bodyContent = htmlBody && (htmlBody.includes('<p>') || htmlBody.includes('<br') || htmlBody.includes('<div>'))
            ? htmlBody 
            : (htmlBody || '').replace(/\n/g, '<br/>');

        let matchedMailbox = null;
        let matchedSettings = null;

        if (customSender && customSender.trim()) {
            const cleanSender = customSender.trim().toLowerCase();
            attemptedSender = cleanSender;

            // 1. Check Mailbox collection
            matchedMailbox = await Mailbox.findOne({ emailUser: cleanSender });
            if (!matchedMailbox) {
                matchedMailbox = await Mailbox.findOne({ emailUser: new RegExp(`^${cleanSender}$`, 'i') });
            }

            // 2. If not found in Mailbox, check EmailSettings collection
            if (!matchedMailbox) {
                matchedSettings = await EmailSettings.findOne({ emailUser: cleanSender });
                if (!matchedSettings) {
                    matchedSettings = await EmailSettings.findOne({ emailUser: new RegExp(`^${cleanSender}$`, 'i') });
                }
            }
        }

        // Case A: Sender identity found in Mailbox pool
        if (matchedMailbox) {
            let pass = matchedMailbox.emailPass;
            try {
                pass = decrypt(matchedMailbox.emailPass);
            } catch (decErr) {
                pass = matchedMailbox.emailPass;
            }

            if (!pass || pass === 'testpass') {
                throw new Error(`Mailbox "${matchedMailbox.emailUser}" does not have valid credentials. Please reconnect it in Mailboxes.`);
            }

            const authUser = matchedMailbox.smtpUser || matchedMailbox.emailUser;
            const isGmail = matchedMailbox.provider === 'gmail' || 
                           matchedMailbox.provider === 'cloudflare' || 
                           (matchedMailbox.smtpHost && matchedMailbox.smtpHost.includes('gmail.com')) ||
                           (matchedMailbox.emailUser && matchedMailbox.emailUser.includes('gmail.com'));

            if (isGmail && pass) {
                pass = pass.replace(/\s+/g, '');
            }

            const senderDisplayName = matchedMailbox.senderName || 'CRM Outreach';
            const senderAddress = matchedMailbox.emailUser;

            const mailOptions = {
                from: `"${senderDisplayName}" <${senderAddress}>`,
                replyTo: senderAddress,
                to: toEmail,
                subject: subject,
                html: `
                    <div style="font-family: sans-serif; font-size: 15px; color: #1f2937; line-height: 1.6;">
                        ${bodyContent}
                    </div>
                `
            };

            const info = await dispatchWithPortFallback({
                host: matchedMailbox.smtpHost || (isGmail ? 'smtp.gmail.com' : 'smtp.hostinger.com'),
                port: matchedMailbox.smtpPort || (isGmail ? 587 : 465),
                authUser,
                pass,
                isGmail,
                mailOptions
            });

            console.log(`✅ Direct email sent to ${toEmail} from ${senderAddress} (via Mailbox auth ${authUser})!`);

            // Update stats on mailbox
            await Mailbox.findByIdAndUpdate(matchedMailbox._id, {
                $inc: { sentToday: 1, 'stats.totalSent': 1 },
                lastSentAt: new Date()
            }).catch(() => {});

            return { 
                success: true, 
                messageId: info.messageId, 
                sender: senderAddress, 
                senderName: senderDisplayName 
            };
        }

        // Case B: Sender found in EmailSettings directly
        if (matchedSettings) {
            let pass = matchedSettings.emailPass;
            try {
                pass = decrypt(matchedSettings.emailPass);
            } catch (decErr) {
                pass = matchedSettings.emailPass;
            }

            if (!pass || pass === 'testpass') {
                throw new Error(`Email account "${matchedSettings.emailUser}" does not have valid credentials. Please configure your App Password in Email Settings.`);
            }

            const isGmail = matchedSettings.provider === 'gmail' || 
                           (matchedSettings.emailUser && matchedSettings.emailUser.includes('gmail.com')) ||
                           (matchedSettings.smtpHost && matchedSettings.smtpHost.includes('gmail.com'));

            if (isGmail && pass) {
                pass = pass.replace(/\s+/g, '');
            }

            const authUser = matchedSettings.smtpUser || matchedSettings.emailUser;
            const senderDisplayName = matchedSettings.senderName || 'CRM Outreach';
            const senderAddress = matchedSettings.emailUser;

            const mailOptions = {
                from: `"${senderDisplayName}" <${senderAddress}>`,
                replyTo: senderAddress,
                to: toEmail,
                subject: subject,
                html: `
                    <div style="font-family: sans-serif; font-size: 15px; color: #1f2937; line-height: 1.6;">
                        ${bodyContent}
                    </div>
                `
            };

            const info = await dispatchWithPortFallback({
                host: matchedSettings.smtpHost || (isGmail ? 'smtp.gmail.com' : 'smtp.resend.com'),
                port: matchedSettings.smtpPort || (isGmail ? 587 : 465),
                authUser,
                pass,
                isGmail,
                mailOptions
            });

            console.log(`✅ Direct email sent to ${toEmail} from ${senderAddress} (via EmailSettings auth ${authUser})!`);

            return { 
                success: true, 
                messageId: info.messageId, 
                sender: senderAddress, 
                senderName: senderDisplayName 
            };
        }

        // Case C: Fallback to user's personal or system EmailSettings
        const { creds } = await createTransporter(userId);

        const senderAddress = (customSender && customSender.trim()) ? customSender.trim().toLowerCase() : creds.user;
        const senderDisplayName = creds.name || 'CRM Outreach';
        const isGmail = creds.provider === 'gmail' || (creds.user && creds.user.includes('gmail.com')) || (creds.host && creds.host.includes('gmail.com'));

        const mailOptions = {
            from: `"${senderDisplayName}" <${senderAddress}>`,
            replyTo: senderAddress,
            to: toEmail,
            subject: subject,
            html: `
                <div style="font-family: sans-serif; font-size: 15px; color: #1f2937; line-height: 1.6;">
                    ${bodyContent}
                </div>
            `
        };

        const info = await dispatchWithPortFallback({
            host: creds.host || (isGmail ? 'smtp.gmail.com' : 'smtp.resend.com'),
            port: creds.port || (isGmail ? 587 : 465),
            authUser: creds.smtpUser || creds.user,
            pass: creds.pass,
            isGmail,
            mailOptions
        });

        console.log(`✅ Direct email sent to ${toEmail} from ${senderAddress} successfully!`);
        return { 
            success: true, 
            messageId: info.messageId, 
            sender: senderAddress, 
            senderName: senderDisplayName 
        };
    } catch (error) {
        console.error('❌ Error sending direct client email:', error.message);
        
        // Clarify common SMTP errors
        if (error.code === 'EAUTH' || (error.message && (error.message.includes('BadCredentials') || error.message.includes('535') || error.message.includes('Username and Password not accepted')))) {
            throw new Error(`Google / SMTP authentication failed for "${attemptedSender}". If using Gmail, ensure 2-Step Verification is ON in your Google Account and generate a 16-character Google App Password (not your standard password). Enter it in Email Settings.`);
        }
        if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKET' || (error.message && error.message.includes('timeout'))) {
            throw new Error(`Connection timed out reaching SMTP server for "${attemptedSender}". Note: Cloud platforms like Render Free Tier block outbound SMTP ports (465 & 587). To send from Render, use an HTTPS email provider (like Resend or Brevo), run locally, or upgrade Render to open SMTP ports.`);
        }

        throw error;
    }
};

module.exports = {
    getActiveEmailCredentials,
    createTransporter,
    sendFollowUpNotification,
    sendDirectClientEmail
};
