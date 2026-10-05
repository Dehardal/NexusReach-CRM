const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
    from: {
        type: String,
        required: true,
        trim: true
    },
    fromName: {
        type: String,
        default: ''
    },
    to: {
        type: String,
        required: true,
        trim: true
    },
    subject: {
        type: String,
        default: '(No Subject)'
    },
    text: {
        type: String,
        default: ''
    },
    html: {
        type: String,
        default: ''
    },
    direction: {
        type: String,
        enum: ['inbound', 'outbound'],
        default: 'inbound'
    },
    folder: {
        type: String,
        enum: ['inbox', 'sent', 'spam', 'trash'],
        default: 'inbox',
        index: true
    },
    isSpam: {
        type: Boolean,
        default: false
    },
    isTrash: {
        type: Boolean,
        default: false
    },
    verificationCode: {
        type: String,
        default: ''
    },
    leadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead',
        default: null
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    messageId: {
        type: String,
        default: ''
    },
    raw: {
        type: String,
        default: ''
    }
}, { timestamps: true });

// Text search on subject, from, to, body
emailSchema.index({ subject: 'text', text: 'text', from: 'text', to: 'text' });
emailSchema.index({ userId: 1, direction: 1, createdAt: -1 });
emailSchema.index({ userId: 1, folder: 1, createdAt: -1 });
emailSchema.index({ direction: 1, createdAt: -1 });

module.exports = mongoose.model('Email', emailSchema);
