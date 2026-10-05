const mongoose = require('mongoose');

const emailSettingsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    senderName: {
        type: String,
        default: 'CRM Outreach'
    },
    emailUser: {
        type: String,
        required: [true, 'Please provide an email address'],
        trim: true,
        lowercase: true,
        index: true
    },
    emailPass: {
        type: String,
        required: [true, 'Please provide an email password or API Key']
    },
    smtpUser: {
        type: String,
        trim: true
    },
    provider: {
        type: String,
        enum: ['gmail', 'outlook', 'custom', 'resend', 'brevo'],
        default: 'custom'
    },
    smtpHost: {
        type: String,
        default: 'smtp.resend.com'
    },
    smtpPort: {
        type: Number,
        default: 587
    },
    isConfigured: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Compound unique index per user
emailSettingsSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('EmailSettings', emailSettingsSchema);
