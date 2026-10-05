const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');

// Patch Client.prototype.inject to gracefully catch frame detachment during logout or navigation
const originalInject = Client.prototype.inject;
Client.prototype.inject = async function (...args) {
    try {
        return await originalInject.apply(this, args);
    } catch (err) {
        const msg = err?.message || String(err);
        if (
            msg.includes('detached Frame') ||
            msg.includes('Target closed') ||
            msg.includes('Session closed') ||
            msg.includes('Execution context was destroyed') ||
            msg.includes('Protocol error')
        ) {
            console.warn('[WHATSAPP] Ignored expected frame/target detachment during inject:', msg);
            return;
        }
        throw err;
    }
};

let client = null;
let connectionStatus = 'DISCONNECTED'; // DISCONNECTED, INITIALIZING, CONNECTED, QR_READY
let lastQrCode = '';
let socketIO = null;

// Initialize the WhatsApp Web Client
const initializeWhatsApp = async (ioInstance, forceFresh = false) => {
    socketIO = ioInstance || socketIO;
    
    // Prevent starting duplicate browser processes if already running
    if (connectionStatus === 'CONNECTED' || (connectionStatus === 'INITIALIZING' && !forceFresh)) {
        console.log('[WHATSAPP] Client is already connected or initializing. Skipping.');
        return;
    }

    // Clean up old client process if exists
    if (client) {
        console.log('[WHATSAPP] Destroying old client process before re-initialization...');
        const oldClient = client;
        client = null;
        try {
            await oldClient.destroy();
        } catch (e) {
            console.warn('[WHATSAPP] Error destroying old client:', e.message);
        }
    }

    console.log('[WHATSAPP] Initializing client (forceFresh:', forceFresh, ')...');
    connectionStatus = 'INITIALIZING';
    lastQrCode = '';
    notifyClients();

    const sessionPath = path.join(__dirname, '../.wwebjs_auth');
    if (forceFresh) {
        const sessionDir = path.join(sessionPath, 'session');
        if (fs.existsSync(sessionDir)) {
            console.log('[WHATSAPP] Force fresh requested. Purging stale session directory...');
            try {
                fs.rmSync(sessionDir, { recursive: true, force: true });
            } catch (e) {
                console.warn('[WHATSAPP] Could not remove stale session dir:', e.message);
            }
        }
    }

    // Clean stale SingletonLock files from previous crashes
    if (fs.existsSync(sessionPath)) {
        const removeLocks = (dir) => {
            try {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    if (file === 'SingletonLock' || file === 'SingletonCookie' || file === 'SingletonSocket') {
                        try { fs.unlinkSync(fullPath); } catch (e) {}
                    } else if (fs.statSync(fullPath).isDirectory()) {
                        removeLocks(fullPath);
                    }
                }
            } catch (e) {}
        };
        removeLocks(sessionPath);
    }

    try {
        // Use LocalAuth to preserve session files in backend/.wwebjs_auth
        client = new Client({
            authStrategy: new LocalAuth({
                dataPath: path.join(__dirname, '../.wwebjs_auth')
            }),
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html',
                strict: false
            },
            puppeteer: {
                headless: true,
                protocolTimeout: 300000,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--disable-gpu'
                ]
            }
        });

        // Event: Loading screen progress
        client.on('loading_screen', (percent, message) => {
            console.log(`[WHATSAPP] Loading screen: ${percent}% - ${message}`);
        });

        // Event: State change
        client.on('change_state', (state) => {
            console.log(`[WHATSAPP] State changed: ${state}`);
        });

        // Event: QR Code generated
        client.on('qr', (qr) => {
            console.log('[WHATSAPP] QR Code received. Broadcasting to clients.');
            connectionStatus = 'QR_READY';
            lastQrCode = qr;
            
            // Broadcast the QR value to the frontend
            if (socketIO) {
                socketIO.emit('whatsapp_qr', qr);
            }
            notifyClients();
        });

        // Event: Authenticated successfully
        client.on('authenticated', () => {
            console.log('[WHATSAPP] Authenticated successfully');
        });

        // Event: Session ready
        client.on('ready', () => {
            console.log('[WHATSAPP] Client is ready and connected!');
            connectionStatus = 'CONNECTED';
            lastQrCode = '';
            notifyClients();
        });

        // Event: Authentication failure
        client.on('auth_failure', (msg) => {
            console.error('[WHATSAPP] Authentication failed:', msg);
            connectionStatus = 'DISCONNECTED';
            lastQrCode = '';
            notifyClients();

            const sessionDir = path.join(__dirname, '../.wwebjs_auth/session');
            if (fs.existsSync(sessionDir)) {
                try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
            }
        });

        // Event: Disconnected
        client.on('disconnected', (reason) => {
            console.log('[WHATSAPP] Client disconnected. Reason:', reason);
            connectionStatus = 'DISCONNECTED';
            lastQrCode = '';
            notifyClients();
            
            if (reason === 'LOGOUT') {
                console.log('[WHATSAPP] Account logged out. Purging session directory...');
                const sessionDir = path.join(__dirname, '../.wwebjs_auth/session');
                if (fs.existsSync(sessionDir)) {
                    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
                }
            }

            // Safely destroy client after letting internal async event listeners settle
            const clientToDestroy = client;
            client = null;
            setTimeout(async () => {
                if (clientToDestroy) {
                    try {
                        await clientToDestroy.destroy();
                    } catch (e) {
                        console.warn('[WHATSAPP] Error destroying client after disconnect:', e.message);
                    }
                }
            }, 1000);
        });

    // Event: Incoming & Outgoing message creation
    client.on('message_create', async (msg) => {
        if (msg.isStatus || !msg.body) return;

        const remoteJid = msg.fromMe ? msg.to : msg.from;
        const cleanPhone = (remoteJid || '').replace(/\D/g, '');
        const last10 = cleanPhone.slice(-10);
        
        console.log(`[WHATSAPP MSG] ${msg.fromMe ? 'Outgoing to' : 'Incoming from'} ${remoteJid} (${last10}): ${msg.body}`);

        if (last10.length === 10) {
            try {
                const Lead = require('../models/Lead');
                const leads = await Lead.find({});
                const matchedLead = leads.find(l => {
                    if (!l.phone) return false;
                    const cp = l.phone.replace(/\D/g, '');
                    return cp.endsWith(last10);
                });
                
                if (matchedLead) {
                    const senderType = msg.fromMe ? 'sales' : 'lead';
                    
                    // Prevent duplicate logging if message was logged by API send endpoint
                    const isDup = matchedLead.whatsappMessages.some(m => 
                        m.sender === senderType && 
                        m.text === msg.body && 
                        Math.abs(new Date(m.timestamp).getTime() - (msg.timestamp * 1000)) < 15000
                    );

                    if (!isDup) {
                        console.log(`[WHATSAPP] Logging ${senderType} message for lead: ${matchedLead.name}`);
                        matchedLead.whatsappMessages.push({
                            sender: senderType,
                            text: msg.body,
                            timestamp: new Date(msg.timestamp * 1000)
                        });
                        
                        if (!msg.fromMe) {
                            matchedLead.activity.push({
                                description: `Received WhatsApp reply: "${msg.body.substring(0, 30)}..."`,
                                timestamp: new Date()
                            });
                        }
                        
                        await matchedLead.save();
                    }
                }
            } catch (err) {
                console.error('[WHATSAPP] Error logging message:', err.message);
            }
        }

        // Broadcast to all frontend clients for live update
        if (socketIO) {
            socketIO.emit('whatsapp_message', {
                from: msg.from,
                to: msg.to,
                remoteJid: remoteJid,
                phone10: last10,
                body: msg.body,
                timestamp: msg.timestamp * 1000,
                fromMe: msg.fromMe
            });
        }
    });

        client.initialize().catch(err => {
            console.error('[WHATSAPP] Initialization error:', err.message);
            connectionStatus = 'DISCONNECTED';
            notifyClients();
        });
    } catch (err) {
        console.error('[WHATSAPP] Instantiation error:', err.message);
        connectionStatus = 'DISCONNECTED';
        notifyClients();
    }
};

// Helper: Notify all socket clients about current status
const notifyClients = () => {
    if (socketIO) {
        socketIO.emit('whatsapp_status', {
            status: connectionStatus,
            hasQr: !!lastQrCode,
            qrCode: lastQrCode
        });
    }
};

// Get current status
const getStatus = () => {
    return {
        status: connectionStatus,
        qrCode: lastQrCode
    };
};

// Send a direct message to a lead
const sendMessage = async (phone, text) => {
    if (connectionStatus !== 'CONNECTED' || !client) {
        throw new Error('WhatsApp is not connected. Please scan the QR code first.');
    }

    // Format phone number to WhatsApp format (e.g. 919876543210@c.us)
    // Strip non-numeric characters
    let cleanNumber = phone.replace(/\D/g, '');
    
    // Default country code: Add 91 (India) if length is 10 digits
    if (cleanNumber.length === 10) {
        cleanNumber = '91' + cleanNumber;
    }
    
    const formattedId = `${cleanNumber}@c.us`;

    console.log(`[WHATSAPP] Sending message to ${formattedId}: ${text}`);
    try {
        const chat = await client.getChatById(formattedId);
        const msg = await chat.sendMessage(text);
        return msg;
    } catch (chatError) {
        console.warn('[WHATSAPP] getChatById failed, falling back to direct send:', chatError.message);
        const msg = await client.sendMessage(formattedId, text);
        return msg;
    }
};

// Log Out / Disconnect Session
const logoutSession = async () => {
    if (client) {
        console.log('[WHATSAPP] Logging out active session...');
        const currentClient = client;
        client = null;
        connectionStatus = 'DISCONNECTED';
        lastQrCode = '';
        notifyClients();

        try {
            await currentClient.logout();
        } catch (err) {
            console.warn('[WHATSAPP] Logout threw error (often normal if already disconnected):', err.message);
        } finally {
            try {
                await currentClient.destroy();
            } catch (e) {}
        }
    } else {
        connectionStatus = 'DISCONNECTED';
        lastQrCode = '';
        notifyClients();
    }

    // Clean session directory to ensure fresh QR on reconnect
    const sessionPath = path.join(__dirname, '../.wwebjs_auth');
    if (fs.existsSync(sessionPath)) {
        try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
        } catch (e) {}
    }
};

// Fetch all active chat threads from WhatsApp Web client
const getChats = async () => {
    if (connectionStatus !== 'CONNECTED' || !client) {
        throw new Error('WhatsApp is not connected.');
    }
    const rawChats = await client.getChats();
    
    // Format and return chats (excluding groups)
    const formattedChats = rawChats
        .filter(c => !c.isGroup)
        .map(c => ({
            id: c.id._serialized,
            name: c.name || c.id.user,
            unreadCount: c.unreadCount,
            timestamp: c.timestamp * 1000,
            lastMessage: c.lastMessage ? {
                body: c.lastMessage.body,
                fromMe: c.lastMessage.fromMe,
                timestamp: c.lastMessage.timestamp * 1000
            } : null
        }));

    return formattedChats;
};

// Fetch message log for a specific chat
const getChatMessages = async (chatId, limit = 50) => {
    if (connectionStatus !== 'CONNECTED' || !client) {
        throw new Error('WhatsApp is not connected.');
    }
    const chat = await client.getChatById(chatId);
    const rawMessages = await chat.fetchMessages({ limit });
    
    const formattedMessages = rawMessages.map(m => ({
        id: m.id._serialized,
        body: m.body,
        fromMe: m.fromMe,
        timestamp: m.timestamp * 1000,
        sender: m.fromMe ? 'sales' : 'lead'
    }));

    return formattedMessages;
};

// Force reset session and trigger a fresh QR generation
const resetSession = async () => {
    console.log('[WHATSAPP] Hard resetting WhatsApp session...');
    if (client) {
        try {
            await client.destroy();
        } catch (e) {}
        client = null;
    }
    connectionStatus = 'DISCONNECTED';
    lastQrCode = '';
    notifyClients();

    const sessionDir = path.join(__dirname, '../.wwebjs_auth/session');
    if (fs.existsSync(sessionDir)) {
        try {
            fs.rmSync(sessionDir, { recursive: true, force: true });
            console.log('[WHATSAPP] Session directory purged successfully.');
        } catch (e) {
            console.warn('[WHATSAPP] Error purging session dir:', e.message);
        }
    }

    return initializeWhatsApp(null, true);
};

module.exports = {
    initializeWhatsApp,
    getStatus,
    sendMessage,
    logoutSession,
    resetSession,
    getChats,
    getChatMessages
};
