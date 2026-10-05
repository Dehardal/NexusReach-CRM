const express = require('express');
const router = express.Router();
const { getStatus, logoutSession, resetSession, getChats, getChatMessages, sendMessage, initializeWhatsApp } = require('../services/whatsappService');
const { protect } = require('../middleware/auth');

// @desc    Get WhatsApp connection status & QR Code
// @route   GET /api/whatsapp/status
// @access  Private
router.get('/status', protect, (req, res) => {
    try {
        const info = getStatus();
        res.json(info);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Log out and reset WhatsApp Web session
// @route   POST /api/whatsapp/logout
// @access  Private
router.post('/logout', protect, async (req, res) => {
    try {
        await logoutSession();
        res.json({ message: 'WhatsApp session logged out successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all active chats list
// @route   GET /api/whatsapp/chats
// @access  Private
router.get('/chats', protect, async (req, res) => {
    try {
        const chats = await getChats();
        res.json(chats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get messages for a specific chat
// @route   GET /api/whatsapp/chats/:chatId/messages
// @access  Private
router.get('/chats/:chatId/messages', protect, async (req, res) => {
    try {
        const messages = await getChatMessages(req.params.chatId);
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Send a WhatsApp message
// @route   POST /api/whatsapp/send
// @access  Private
router.post('/send', protect, async (req, res) => {
    const { to, text } = req.body;
    if (!to || !text) {
        return res.status(400).json({ message: 'Missing recipient (to) or message text' });
    }

    try {
        await sendMessage(to, text);
        res.json({ message: 'Message sent successfully!' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Trigger WhatsApp client initialization
// @route   POST /api/whatsapp/connect
// @access  Private
router.post('/connect', protect, async (req, res) => {
    try {
        const forceFresh = req.body?.forceFresh || false;
        await initializeWhatsApp(null, forceFresh);
        res.json({ message: 'WhatsApp connection process started' });
    } catch (error) {
        console.error('[WHATSAPP CONNECT ERROR]', error);
        res.status(500).json({ message: error.message || 'Failed to initialize WhatsApp process' });
    }
});

// @desc    Hard reset session and force generate fresh QR code
// @route   POST /api/whatsapp/reset
// @access  Private
router.post('/reset', protect, async (req, res) => {
    try {
        await resetSession();
        res.json({ message: 'WhatsApp session reset. Generating fresh QR code...' });
    } catch (error) {
        console.error('[WHATSAPP RESET ERROR]', error);
        res.status(500).json({ message: error.message || 'Failed to reset WhatsApp session' });
    }
});

module.exports = router;
