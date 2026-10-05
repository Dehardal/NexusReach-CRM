const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name']
    },
    email: {
        type: String
    },
    phone: {
        type: String,
        required: [true, 'Please add a phone number']
    },
    ageGroup: { type: String },
    city: { type: String },
    state: { type: String },
    status: {
        type: String,
        enum: ['New', 'Contacted', 'Won', 'Lost', 'No Answer', 'Follow-up', 'Not Interested', 'Enrolled', 'Closed', 'Hot'],
        default: 'New'
    },
    profession: { type: String },
    location: { type: String },
    qualification: { type: String },
    dob: { type: Date },
    experience: { type: String },
    course: { type: String },
    website: { type: String },
    socialLink: { type: String },
    notes: [{
        body: String,
        author: String,
        createdAt: { type: Date, default: Date.now }
    }],
    activity: [{
        description: String,
        timestamp: { type: Date, default: Date.now }
    }],
    recordings: [{
        url: String,
        duration: String,
        createdAt: { type: Date, default: Date.now }
    }],
    followUp: {
        date: Date,
        time: String,
        notes: String
    },
    privateNote: {
        type: String,
        default: ''
    },
    notInterestedReason: {
        reason: String,
        notes: String
    },
    source: {
        type: String
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    assignedAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    campaignStatus: {
        type: String,
        enum: ['uncontacted', 'queued', 'sent', 'replied', 'bounced'],
        default: 'uncontacted'
    },
    isTransferred: {
        type: Boolean,
        default: false
    },
    transferredFrom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    transferredTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    transferredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    transferredAt: {
        type: Date
    },
    transferNotes: {
        type: String,
        default: ''
    },
    isHidden: {
        type: Boolean,
        default: false
    },
    batchId: {
        type: String
    },
    importedAt: {
        type: Date,
        default: Date.now
    },
    followUpCount: {
        type: Number,
        default: 0
    },
    sourceType: {
        type: String,
        enum: ['system', 'outsource'],
        default: 'system'
    },
    remark: { type: String },
    feesCollected: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    enrolledAt: { type: Date },
    
    // New AI Automation and WhatsApp features
    aiScore: {
        type: String,
        enum: ['Hot', 'Warm', 'Cold'],
        default: 'Cold'
    },
    aiSummary: {
        type: String,
        default: ''
    },
    whatsappMessages: [{
        sender: {
            type: String,
            enum: ['sales', 'lead']
        },
        text: String,
        timestamp: { type: Date, default: Date.now }
    }],
    emailDrafts: [{
        subject: String,
        body: String,
        category: String,
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// Index search capabilities for fast filtration and text lookup
leadSchema.index({ name: 'text', email: 'text', phone: 'text' });
leadSchema.index({ status: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ aiScore: 1 });

module.exports = mongoose.model('Lead', leadSchema);
