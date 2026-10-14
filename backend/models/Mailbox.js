const mongoose = require('mongoose');

const mailboxSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    senderName: {
        type: String,
        default: 'Admissions & Outreach',
        trim: true
    },
    emailUser: {
        type: String,
        required: [true, 'Please provide an email address'],
        trim: true,
        lowercase: true
    },
    emailPass: {
        type: String,
        required: [true, 'Please provide an email password or app password']
    },
    mailboxResourceId: {
        type: String,
        default: ''
    },
    isApiManaged: {
        type: Boolean,
        default: false
    },
    provider: {
        type: String,
        enum: ['hostinger', 'gmail', 'cloudflare', 'custom', 'brevo', 'resend', 'outlook'],
        default: 'hostinger'
    },
    smtpUser: {
        type: String,
        default: '',
        trim: true
    },
    smtpHost: {
        type: String,
        default: 'smtp.hostinger.com',
        trim: true
    },
    smtpPort: {
        type: Number,
        default: 465
    },
    smtpSecure: {
        type: Boolean,
        default: true
    },
    imapHost: {
        type: String,
        default: 'imap.hostinger.com',
        trim: true
    },
    imapPort: {
        type: Number,
        default: 993
    },
    imapSecure: {
        type: Boolean,
        default: true
    },
    dailyLimit: {
        type: Number,
        default: 100
    },
    sentToday: {
        type: Number,
        default: 0
    },
    lastSentAt: {
        type: Date
    },
    status: {
        type: String,
        enum: ['active', 'paused', 'error'],
        default: 'active'
    },
    lastError: {
        type: String,
        default: ''
    },
    stats: {
        totalSent: { type: Number, default: 0 },
        totalReplies: { type: Number, default: 0 },
        totalBounces: { type: Number, default: 0 }
    }
}, { timestamps: true });

// Ensure emailUser is unique per userId (a user cannot add the exact same email twice)
mailboxSchema.index({ userId: 1, emailUser: 1 }, { unique: true });

module.exports = mongoose.model('Mailbox', mailboxSchema);
