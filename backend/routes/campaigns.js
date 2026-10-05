const express = require('express');
const router = express.Router();
const Campaign = require('../models/Campaign');
const Mailbox = require('../models/Mailbox');
const Lead = require('../models/Lead');
const { protect } = require('../middleware/auth');
const { sendCampaignBatch } = require('../services/campaignService');

// @desc    Get all campaigns
// @route   GET /api/campaigns
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        let filter = { createdBy: req.user._id };
        if (['master', 'admin'].includes(req.user.role)) {
            filter = {}; // Master/Admin sees all campaigns
        }

        const campaigns = await Campaign.find(filter)
            .populate('createdBy', 'name email role')
            .populate('mailboxesUsed', 'emailUser senderName status')
            .sort({ createdAt: -1 });

        res.json(campaigns);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Create & launch email marketing campaign
// @route   POST /api/campaigns
// @access  Private (Mail Pedia, Master, Admin)
router.post('/', protect, async (req, res) => {
    try {
        const {
            name,
            subject,
            bodyHtml,
            bodyText,
            leadIds,
            mailboxIds,
            autoLaunch = true
        } = req.body;

        if (!name || !subject || !bodyHtml) {
            return res.status(400).json({ message: 'Campaign name, subject, and email body are required' });
        }

        // Check if there are active mailboxes accessible to this user
        let mbQuery = { status: 'active' };
        if (req.user.role !== 'master') {
            mbQuery.$or = [{ userId: req.user._id }, { assignedTo: req.user._id }];
        }
        if (Array.isArray(mailboxIds) && mailboxIds.length > 0) {
            mbQuery._id = { $in: mailboxIds };
        }
        const activeMailboxes = await Mailbox.find(mbQuery);
        if (activeMailboxes.length === 0) {
            return res.status(400).json({
                message: 'No active Hostinger mailboxes assigned or accessible to your account. Please ask your administrator to assign mailboxes to you.'
            });
        }

        const campaign = await Campaign.create({
            name,
            createdBy: req.user._id,
            assignedAdmin: req.user.assignedAdmin || (req.user.role === 'admin' ? req.user._id : null),
            subject,
            bodyHtml,
            bodyText: bodyText || bodyHtml.replace(/<[^>]+>/g, ''),
            mailboxesUsed: activeMailboxes.map(m => m._id),
            status: 'draft'
        });

        // Launch sending asynchronously in background
        if (autoLaunch) {
            const io = req.app.get('io');
            // Execute in background
            sendCampaignBatch({
                campaignId: campaign._id,
                userId: req.user._id,
                leadIds,
                subject,
                bodyHtml,
                bodyText: campaign.bodyText,
                mailboxIds: activeMailboxes.map(m => m._id),
                io
            }).catch(err => {
                console.error('[CAMPAIGN ASYNC FAILURE]', err.message);
            });
        }

        res.status(201).json({
            success: true,
            message: 'Campaign created and queued for delivery across Hostinger mailbox pool',
            campaign
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get single campaign stats
// @route   GET /api/campaigns/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id)
            .populate('createdBy', 'name email role')
            .populate('mailboxesUsed', 'emailUser senderName status sentToday');

        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        res.json(campaign);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
