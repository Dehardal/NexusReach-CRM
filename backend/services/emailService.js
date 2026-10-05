const nodemailer = require('nodemailer');
const EmailSettings = require('../models/EmailSettings');
const { decrypt } = require('../utils/crypto');

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

        if (settings && settings.emailUser && settings.emailPass) {
            const decryptedPass = decrypt(settings.emailPass);
            return {
                user: settings.emailUser,
                smtpUser: settings.smtpUser || settings.emailUser,
                pass: decryptedPass,
                name: settings.senderName || 'CRM Outreach',
                provider: settings.provider || 'custom',
                host: settings.smtpHost || 'smtp.resend.com',
                port: settings.smtpPort || 587
            };
        }
    } catch (e) {
        console.warn('[EMAIL SERVICE] Could not load user settings, falling back to env:', e.message);
    }

    return {
        user: process.env.EMAIL_USER,
        smtpUser: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
        name: 'CRM Outreach',
        provider: 'gmail',
        host: 'smtp.gmail.com',
        port: 587
    };
};

// Helper to build transport options
const buildTransportConfig = (creds) => {
    if (creds.provider === 'gmail') {
        return {
            service: 'gmail',
            auth: {
                user: creds.smtpUser || creds.user,
                pass: creds.pass
            }
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
            }
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
            }
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
            }
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
        }
    };
};

// Create user-specific or system nodemailer transporter
const createTransporter = async (userId = null) => {
    const creds = await getActiveEmailCredentials(userId);

    if (!creds.user || !creds.pass) {
        throw new Error('Email integration is not configured for your account. Please configure your email in Email Settings.');
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

// Send direct client email (supports user-specific credentials)
const sendDirectClientEmail = async (toEmail, subject, htmlBody, userId = null) => {
    try {
        const { transporter, creds } = await createTransporter(userId);
        
        const bodyContent = htmlBody.includes('<p>') || htmlBody.includes('<br') 
            ? htmlBody 
            : htmlBody.replace(/\n/g, '<br/>');

        const mailOptions = {
            from: {
                name: creds.name || 'CRM Outreach',
                address: creds.user
            },
            replyTo: creds.user,
            to: toEmail,
            subject: subject,
            html: `
                <div style="font-family: sans-serif; font-size: 15px; color: #1f2937; line-height: 1.6;">
                    ${bodyContent}
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Direct client email sent to ${toEmail} from ${creds.user} successfully!`);
        return { success: true, messageId: info.messageId, sender: creds.user };
    } catch (error) {
        console.error('❌ Error sending direct client email:', error.message);
        throw error;
    }
};

module.exports = {
    getActiveEmailCredentials,
    createTransporter,
    sendFollowUpNotification,
    sendDirectClientEmail
};
