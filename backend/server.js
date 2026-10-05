const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/db');
const { initializeWhatsApp } = require('./services/whatsappService');

const app = express();
const server = http.createServer(app);

// Socket.IO Setup for real-time QR code transmission and messages
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.set('io', io);

// Pass Socket.IO to WhatsApp Service to stream scanning status
initializeWhatsApp(io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve file uploads if any
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes mapping
app.use('/api/auth', require('./routes/auth'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/email', require('./routes/email'));
app.use('/api/email-settings', require('./routes/emailSettings'));
app.use('/api/mailboxes', require('./routes/mailboxes'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/scraper', require('./routes/scraper'));

// Serve React Frontend Production Build
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', time: new Date() });
});

// React Router Fallback - Route all unknown endpoints to index.html
app.get('*', (req, res) => {
    if (req.url.startsWith('/api')) {
        return res.status(404).json({ message: 'API Route Not Found' });
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('--- SERVER ERROR ---');
    console.error(err.stack);
    res.status(500).json({
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Process-level safety net for asynchronous library rejections (e.g. Puppeteer detached frames)
process.on('unhandledRejection', (reason, promise) => {
    console.warn('[SERVER] Caught unhandled promise rejection:', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
    console.error('[SERVER] Caught uncaught exception:', err?.message || err);
});

const PORT = process.env.PORT || 12000;

// Connect Database first, then launch Web Server
connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`\n=================================================`);
        console.log(`🚀 Standalone CRM v2 running on port ${PORT}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`=================================================\n`);
    });
});
