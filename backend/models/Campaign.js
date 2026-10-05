const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a campaign name'],
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    subject: {
        type: String,
        required: [true, 'Please provide an email subject'],
        trim: true
    },
    bodyHtml: {
        type: String,
        required: true
    },
    bodyText: {
        type: String
    },
    mailboxesUsed: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mailbox'
    }],
    totalRecipients: {
        type: Number,
        default: 0
    },
    sentCount: {
        type: Number,
        default: 0
    },
    failedCount: {
        type: Number,
        default: 0
    },
    repliesCount: {
        type: Number,
        default: 0
    },
    hotLeadsGenerated: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['draft', 'sending', 'completed', 'paused', 'failed'],
        default: 'draft'
    },
    targetFilter: {
        type: mongoose.Schema.Types.Mixed
    },
    completedAt: {
        type: Date
    }
}, { timestamps: true });

module.exports = mongoose.model('Campaign', campaignSchema);
