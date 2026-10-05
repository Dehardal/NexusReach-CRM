import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { MessageSquare, Send, ExternalLink, RefreshCw, User, PlusCircle, Search, Sparkles } from 'lucide-react';

const WhatsAppInbox = () => {
    const { api, whatsAppStatus, socket } = useAuth();
    const toast = useToast();
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingChats, setLoadingChats] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);
    
    // Search & New Chat Modal
    const [searchQuery, setSearchQuery] = useState('');
    const [newChatModalOpen, setNewChatModalOpen] = useState(false);
    const [newChatPhone, setNewChatPhone] = useState('');
    const [newChatName, setNewChatName] = useState('');

    const messagesEndRef = useRef(null);

    // Create a new direct chat thread
    const handleCreateNewChat = () => {
        let phoneDigits = newChatPhone.replace(/\D/g, '');
        if (!phoneDigits) {
            toast.error('Please enter a valid phone number');
            return;
        }
        
        if (phoneDigits.length === 10) {
            phoneDigits = '91' + phoneDigits;
        }
        
        const formattedJid = `${phoneDigits}@c.us`;
        
        const existing = chats.find(c => c.id === formattedJid);
        if (existing) {
            setActiveChat(existing);
            setNewChatModalOpen(false);
            return;
        }
        
        const newChatItem = {
            id: formattedJid,
            name: newChatName.trim() || phoneDigits,
            phone: newChatPhone,
            status: 'New Contact',
            unreadCount: 0,
            timestamp: Date.now(),
            lastMessage: null,
            whatsappMessages: []
        };
        
        setChats(prev => [newChatItem, ...prev]);
        setActiveChat(newChatItem);
        
        setNewChatPhone('');
        setNewChatName('');
        setNewChatModalOpen(false);
    };

    // Fetch CRM Leads & WhatsApp Web Chats into a Unified Contact List
    const fetchChatsAndLeads = async () => {
        setLoadingChats(true);
        try {
            // 0. Live status check to sync with backend state
            let currentStatus = whatsAppStatus;
            try {
                const { data: statusData } = await api.get('/whatsapp/status');
                if (statusData && statusData.status) {
                    currentStatus = statusData.status;
                    setWhatsAppStatus(statusData.status);
                }
            } catch (e) {}

            // 1. Fetch all CRM leads
            let crmLeadsList = [];
            try {
                const { data } = await api.get('/leads?limit=500');
                if (data && data.leads) {
                    crmLeadsList = data.leads;
                }
            } catch (err) {
                console.error('[INBOX] Error fetching CRM leads:', err);
            }

            // 2. Fetch live WhatsApp Web chats if connected
            let waChatsList = [];
            if (currentStatus === 'CONNECTED') {
                try {
                    const { data } = await api.get('/whatsapp/chats');
                    if (Array.isArray(data)) waChatsList = data;
                } catch (err) {
                    console.error('[INBOX] Error fetching WA chats:', err);
                }
            }

            // 3. Merge CRM leads & WhatsApp Web threads
            const mergedMap = new Map();

            crmLeadsList.forEach(lead => {
                if (lead.phone && lead.phone !== 'N/A') {
                    let cleanPhone = lead.phone.replace(/\D/g, '');
                    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
                    const jid = `${cleanPhone}@c.us`;

                    const lastMsg = lead.whatsappMessages && lead.whatsappMessages.length > 0
                        ? lead.whatsappMessages[lead.whatsappMessages.length - 1]
                        : null;

                    mergedMap.set(jid, {
                        id: jid,
                        leadId: lead._id,
                        name: lead.name || cleanPhone,
                        phone: lead.phone,
                        status: lead.status || 'New',
                        course: lead.course || '',
                        unreadCount: 0,
                        timestamp: lastMsg ? new Date(lastMsg.timestamp).getTime() : new Date(lead.createdAt).getTime(),
                        lastMessage: lastMsg ? {
                            body: lastMsg.text,
                            fromMe: lastMsg.sender === 'sales',
                            timestamp: new Date(lastMsg.timestamp).getTime()
                        } : null,
                        whatsappMessages: lead.whatsappMessages || []
                    });
                }
            });

            // Merge with live WhatsApp Web threads
            waChatsList.forEach(waChat => {
                const existing = mergedMap.get(waChat.id);
                if (existing) {
                    mergedMap.set(waChat.id, {
                        ...existing,
                        unreadCount: waChat.unreadCount || 0,
                        timestamp: waChat.timestamp || existing.timestamp,
                        lastMessage: waChat.lastMessage || existing.lastMessage
                    });
                } else {
                    mergedMap.set(waChat.id, {
                        id: waChat.id,
                        leadId: null,
                        name: waChat.name || waChat.id.replace('@c.us', ''),
                        phone: waChat.id.replace('@c.us', ''),
                        status: 'Direct Contact',
                        unreadCount: waChat.unreadCount || 0,
                        timestamp: waChat.timestamp || Date.now(),
                        lastMessage: waChat.lastMessage || null,
                        whatsappMessages: []
                    });
                }
            });

            const mergedList = Array.from(mergedMap.values()).sort((a, b) => b.timestamp - a.timestamp);
            setChats(mergedList);
            
            // Auto select first contact if none active
            if (!activeChat && mergedList.length > 0) {
                setActiveChat(mergedList[0]);
            }
        } catch (err) {
            console.error('[INBOX] Error fetching chats:', err);
        } finally {
            setLoadingChats(false);
        }
    };

    useEffect(() => {
        fetchChatsAndLeads();
    }, [whatsAppStatus]);

    // Fetch messages for active selected chat
    const fetchMessages = async (chat) => {
        if (!chat) return;
        setLoadingMessages(true);
        try {
            let storedMsgs = (chat.whatsappMessages || []).map(m => ({
                id: m._id || Math.random().toString(),
                body: m.text,
                fromMe: m.sender === 'sales',
                timestamp: new Date(m.timestamp).getTime(),
                sender: m.sender
            }));

            let combinedMsgs = storedMsgs;

            if (whatsAppStatus === 'CONNECTED') {
                try {
                    const { data } = await api.get(`/whatsapp/chats/${encodeURIComponent(chat.id)}/messages`);
                    if (Array.isArray(data) && data.length > 0) {
                        const msgMap = new Map();
                        storedMsgs.forEach(m => msgMap.set(`${m.body}_${Math.floor(m.timestamp/5000)}`, m));
                        data.forEach(m => msgMap.set(`${m.body}_${Math.floor(m.timestamp/5000)}`, m));
                        combinedMsgs = Array.from(msgMap.values()).sort((a, b) => a.timestamp - b.timestamp);
                    }
                } catch (e) {}
            }

            setMessages(combinedMsgs);
        } catch (err) {
            console.error('[INBOX] Error fetching messages:', err);
        } finally {
            setLoadingMessages(false);
        }
    };

    useEffect(() => {
        if (activeChat) {
            fetchMessages(activeChat);
        }
    }, [activeChat]);

    // Scroll to bottom of chat history
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loadingMessages]);

    // Real-time socket message handler
    useEffect(() => {
        if (!socket) return;

        const handleIncomingMessage = (msg) => {
            const msgPhone10 = (msg.phone10 || (msg.fromMe ? msg.to : msg.from) || '').replace(/\D/g, '').slice(-10);
            
            if (activeChat) {
                const activePhone10 = (activeChat.phone || activeChat.id || '').replace(/\D/g, '').slice(-10);
                if (msgPhone10 && activePhone10 && msgPhone10 === activePhone10) {
                    setMessages(prev => [...prev, {
                        id: Math.random().toString(),
                        body: msg.body,
                        fromMe: msg.fromMe,
                        timestamp: msg.timestamp,
                        sender: msg.fromMe ? 'sales' : 'lead'
                    }]);
                }
            }

            setChats(prevChats => {
                const updated = prevChats.map(c => {
                    const cPhone10 = (c.phone || c.id || '').replace(/\D/g, '').slice(-10);
                    if (msgPhone10 && cPhone10 && msgPhone10 === cPhone10) {
                        return {
                            ...c,
                            timestamp: msg.timestamp,
                            unreadCount: activeChat && (activeChat.phone || activeChat.id || '').replace(/\D/g, '').slice(-10) === msgPhone10 ? c.unreadCount : c.unreadCount + 1,
                            lastMessage: {
                                body: msg.body,
                                fromMe: msg.fromMe,
                                timestamp: msg.timestamp
                            }
                        };
                    }
                    return c;
                });
                return updated.sort((a, b) => b.timestamp - a.timestamp);
            });
        };

        socket.on('whatsapp_message', handleIncomingMessage);

        return () => {
            socket.off('whatsapp_message', handleIncomingMessage);
        };
    }, [socket, activeChat]);

    // Send WhatsApp message
    const handleSendMessage = async (e) => {
        e?.preventDefault();
        if (!newMessage.trim() || !activeChat || sending) return;

        if (whatsAppStatus !== 'CONNECTED') {
            toast.error('WhatsApp Web is not linked! Scan the QR code under "WhatsApp Link" in sidebar to send live messages.');
            return;
        }

        setSending(true);
        const textToSend = newMessage;
        setNewMessage('');

        try {
            if (activeChat.leadId) {
                await api.post(`/leads/${activeChat.leadId}/whatsapp`, { text: textToSend });
            } else {
                await api.post('/whatsapp/send', {
                    to: activeChat.id,
                    text: textToSend
                });
            }

            setMessages(prev => [...prev, {
                id: Math.random().toString(),
                body: textToSend,
                fromMe: true,
                timestamp: Date.now(),
                sender: 'sales'
            }]);

            setChats(prevChats => {
                const updated = prevChats.map(c => {
                    if (c.id === activeChat.id) {
                        return {
                            ...c,
                            timestamp: Date.now(),
                            lastMessage: {
                                body: textToSend,
                                fromMe: true,
                                timestamp: Date.now()
                            }
                        };
                    }
                    return c;
                });
                return updated.sort((a, b) => b.timestamp - a.timestamp);
            });

            toast.success('WhatsApp message sent!');
        } catch (err) {
            console.error('[INBOX] Failed to send message:', err);
            const msg = typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || err.message);
            toast.error('Failed to send message: ' + msg);
        } finally {
            setSending(false);
        }
    };

    // Open official web.whatsapp.com
    const handleLaunchOfficialWeb = () => {
        const url = 'https://web.whatsapp.com';
        const title = 'OfficialWhatsAppWeb';
        const specs = 'width=1100,height=800,scrollbars=yes,status=no,location=no,toolbar=no,menubar=no';
        window.open(url, title, specs);
    };

    // Trigger backend connection initialization
    const handleTriggerConnect = async () => {
        try {
            toast.info('Initializing live WhatsApp Web connection...');
            await api.post('/whatsapp/connect');
            fetchChatsAndLeads();
        } catch (err) {
            toast.error('Failed to start WhatsApp process: ' + (err.response?.data?.message || err.message));
        }
    };

    // Quick templates
    const handleUseTemplate = (templateText) => {
        setNewMessage(templateText);
    };

    const templates = [
        { name: 'Request Callback', text: 'Hello! I tried calling you regarding your inquiry but couldn\'t connect. Please let me know a suitable time to call you back. Thanks!' },
        { name: 'Brochure Sent', text: 'Hi! I have shared our course curriculum and brochure on your email. Let me know if you have any questions.' },
        { name: 'Schedule Meeting', text: 'Hello, let\'s connect over a short Zoom/Google Meet call tomorrow to discuss your requirements. Will 4 PM suit you?' }
    ];

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Status Banners */}
            {whatsAppStatus === 'INITIALIZING' && (
                <div style={{ 
                    padding: '12px 18px', 
                    borderRadius: '12px', 
                    background: 'rgba(59, 130, 246, 0.12)', 
                    border: '1px solid rgba(59, 130, 246, 0.35)', 
                    display: 'flex', 
                    justify: 'space-between', 
                    alignItems: 'center' 
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#60a5fa' }}>
                        <RefreshCw size={16} className="spin" style={{ animation: 'spin 2s linear infinite' }} />
                        <span>⏳ <strong>Connecting to WhatsApp Web:</strong> Restoring session in background. Please wait a moment...</span>
                    </div>
                </div>
            )}

            {whatsAppStatus === 'DISCONNECTED' && (
                <div style={{ 
                    padding: '12px 18px', 
                    borderRadius: '12px', 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    border: '1px solid rgba(239, 68, 68, 0.3)', 
                    display: 'flex', 
                    justify: 'space-between', 
                    alignItems: 'center' 
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#f87171' }}>
                        <span>⚠️ <strong>WhatsApp Web Offline:</strong> Displaying all {chats.length} CRM contacts below. To send live messages, link your WhatsApp account.</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            onClick={handleTriggerConnect}
                            className="btn-primary" 
                            style={{ padding: '6px 14px', fontSize: '12px', background: '#3b82f6', border: 'none', cursor: 'pointer' }}
                        >
                            Connect Live Session
                        </button>
                        <a href="/whatsapp-settings" className="btn-secondary" style={{ padding: '6px 14px', fontSize: '12px', textDecoration: 'none' }}>
                            Scan QR Code
                        </a>
                    </div>
                </div>
            )}

            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 800 }}>WhatsApp Inbox</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
                        Manage customer conversations and send direct outreach ({chats.length} CRM Contacts)
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={fetchChatsAndLeads} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px' }} title="Sync CRM & WhatsApp">
                        <RefreshCw size={14} />
                        <span>Sync Contacts</span>
                    </button>
                    <button onClick={handleLaunchOfficialWeb} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#10b981', border: 'none' }}>
                        <ExternalLink size={14} />
                        <span>Open Web WhatsApp</span>
                    </button>
                </div>
            </div>

            {/* Split layout workspace */}
            <div className="glass-panel" style={{ height: '680px', display: 'flex', minHeight: 0, overflow: 'hidden', padding: 0 }}>
                
                {/* 1. Left side contacts/chats list pane */}
                <div style={{ width: '340px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    
                    {/* Inbox subheader with start new chat option */}
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.5px' }}>
                            CONNECTED WHATSAPP CONTACTS ({chats.length})
                        </span>
                        <button 
                            onClick={() => setNewChatModalOpen(true)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--accent-color)',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '12.5px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            + New Chat
                        </button>
                    </div>

                    {/* Live Search box */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.05)' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                            <input 
                                type="text"
                                placeholder="Search contacts by name or phone..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '10px',
                                    padding: '8px 12px 8px 34px',
                                    color: '#fff',
                                    fontSize: '13px',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>
                    
                    {/* Chat list history */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {loadingChats ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
                                <RefreshCw size={20} className="spin" style={{ animation: 'spin 2s linear infinite', marginBottom: '8px' }} />
                                <p style={{ fontSize: '13px' }}>Loading CRM contacts...</p>
                            </div>
                        ) : (() => {
                            const filtered = chats.filter(c => 
                                (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                                (c.phone || '').includes(searchQuery) ||
                                c.id.includes(searchQuery)
                            );
                            
                            if (filtered.length === 0) {
                                return (
                                    <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)' }}>
                                        <MessageSquare size={32} style={{ marginBottom: '12px', opacity: 0.5, margin: '0 auto 12px' }} />
                                        <p style={{ fontSize: '13px' }}>No contacts found.</p>
                                    </div>
                                );
                            }

                            return filtered.map(chatItem => {
                                const isActive = activeChat && activeChat.id === chatItem.id;
                                return (
                                    <div 
                                        key={chatItem.id}
                                        onClick={() => setActiveChat(chatItem)}
                                        style={{
                                            padding: '14px 16px',
                                            borderBottom: '1px solid var(--border-color)',
                                            cursor: 'pointer',
                                            background: isActive ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                                            borderLeft: isActive ? '3px solid var(--accent-color)' : '3px solid transparent',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}
                                    >
                                        <div style={{ 
                                            width: '40px', 
                                            height: '40px', 
                                            borderRadius: '50%', 
                                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#fff',
                                            fontWeight: 700,
                                            fontSize: '15px',
                                            flexShrink: 0
                                        }}>
                                            {(chatItem.name || 'C').charAt(0).toUpperCase()}
                                        </div>

                                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                                                <span style={{ 
                                                    fontWeight: 600, 
                                                    fontSize: '13.5px',
                                                    color: '#fff',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}>
                                                    {chatItem.name}
                                                </span>
                                                {chatItem.timestamp && (
                                                    <span style={{ fontSize: '10px', color: 'var(--text-dim)', flexShrink: 0 }}>
                                                        {new Date(chatItem.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <p style={{ 
                                                    fontSize: '12px', 
                                                    color: 'var(--text-secondary)',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    margin: 0
                                                }}>
                                                    {chatItem.lastMessage ? (
                                                        <span>{chatItem.lastMessage.fromMe ? 'You: ' : ''}{chatItem.lastMessage.body}</span>
                                                    ) : (
                                                        <span>{chatItem.phone || chatItem.id}</span>
                                                    )}
                                                </p>
                                                {chatItem.unreadCount > 0 && (
                                                    <span style={{
                                                        background: 'var(--accent-color)',
                                                        color: '#fff',
                                                        fontSize: '10px',
                                                        fontWeight: 700,
                                                        padding: '2px 6px',
                                                        borderRadius: '10px',
                                                        flexShrink: 0
                                                    }}>
                                                        {chatItem.unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>

                {/* 2. Right side active conversation panel */}
                {activeChat ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        
                        {/* Conversation Header Bar */}
                        <div style={{ 
                            padding: '16px 24px', 
                            borderBottom: '1px solid var(--border-color)', 
                            background: 'rgba(0,0,0,0.15)',
                            display: 'flex',
                            justify: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div style={{ 
                                    width: '42px', 
                                    height: '42px', 
                                    borderRadius: '50%', 
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: '16px'
                                }}>
                                    {(activeChat.name || 'C').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{activeChat.name}</h3>
                                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {activeChat.phone || activeChat.id} • <span style={{ color: '#34d399' }}>{activeChat.status || 'Contact'}</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Messages Feed */}
                        <div style={{ 
                            flex: 1, 
                            padding: '24px', 
                            overflowY: 'auto', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '12px',
                            background: 'rgba(0,0,0,0.1)'
                        }}>
                            {loadingMessages ? (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-dim)' }}>
                                    <RefreshCw size={24} className="spin" style={{ animation: 'spin 2s linear infinite' }} />
                                </div>
                            ) : messages.length === 0 ? (
                                <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-dim)' }}>
                                    <MessageSquare size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
                                    <p style={{ fontSize: '14px' }}>No messages logged with {activeChat.name} yet.</p>
                                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Send a WhatsApp message below to start outreach.</p>
                                </div>
                            ) : (
                                messages.map((msg, index) => (
                                    <div 
                                        key={msg.id || index}
                                        style={{
                                            alignSelf: msg.fromMe ? 'flex-end' : 'flex-start',
                                            maxWidth: '70%',
                                            background: msg.fromMe ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' : '#1e202e',
                                            color: '#fff',
                                            padding: '12px 16px',
                                            borderRadius: msg.fromMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                        }}
                                    >
                                        <p style={{ fontSize: '13.5px', lineHeight: 1.4, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                            {msg.body}
                                        </p>
                                        <span style={{ 
                                            display: 'block', 
                                            textAlign: 'right', 
                                            fontSize: '10px', 
                                            color: msg.fromMe ? 'rgba(255,255,255,0.7)' : 'var(--text-dim)',
                                            marginTop: '6px'
                                        }}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Quick Message Templates Bar */}
                        <div style={{ padding: '8px 24px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px', overflowX: 'auto' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-dim)', alignSelf: 'center', fontWeight: 600 }}>Quick Replies:</span>
                            {templates.map((tpl, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleUseTemplate(tpl.text)}
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '16px',
                                        padding: '4px 10px',
                                        color: 'var(--text-secondary)',
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {tpl.name}
                                </button>
                            ))}
                        </div>

                        {/* Message Input Box */}
                        <form onSubmit={handleSendMessage} style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.15)', display: 'flex', gap: '12px' }}>
                            <input 
                                type="text"
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder={`Send WhatsApp message to ${activeChat.name}...`}
                                className="form-input"
                                style={{ flex: 1, borderRadius: '12px', fontSize: '13.5px' }}
                            />
                            <button 
                                type="submit" 
                                disabled={sending || !newMessage.trim()}
                                className="btn-primary"
                                style={{ 
                                    padding: '0 20px', 
                                    borderRadius: '12px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '8px',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    opacity: sending || !newMessage.trim() ? 0.6 : 1
                                }}
                            >
                                <Send size={16} />
                                <span>Send</span>
                            </button>
                        </form>

                    </div>
                ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px', textAlign: 'center' }}>
                        <MessageSquare size={48} style={{ color: 'var(--accent-purple)', marginBottom: '16px' }} />
                        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>WhatsApp Communication Hub</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', maxWidth: '400px', marginBottom: '24px' }}>
                            Select a CRM contact from the list on the left to review conversation history, or start a new chat outreach.
                        </p>
                        <button onClick={() => setNewChatModalOpen(true)} className="btn-primary">
                            + Start New Chat
                        </button>
                    </div>
                )}

            </div>

            {/* New Chat Modal */}
            {newChatModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-card animate-modal-in" style={{ width: '420px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Start New WhatsApp Chat</h3>
                            <button onClick={() => setNewChatModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                                ✕
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Phone Number (with Country Code)</label>
                                <input 
                                    type="text"
                                    value={newChatPhone}
                                    onChange={e => setNewChatPhone(e.target.value)}
                                    placeholder="e.g. 919876543210 or 9876543210"
                                    className="form-input"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Contact Name (Optional)</label>
                                <input 
                                    type="text"
                                    value={newChatName}
                                    onChange={e => setNewChatName(e.target.value)}
                                    placeholder="e.g. Excellence Dental Studio"
                                    className="form-input"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                <button onClick={() => setNewChatModalOpen(false)} className="btn-secondary" style={{ flex: 1 }}>
                                    Cancel
                                </button>
                                <button onClick={handleCreateNewChat} className="btn-primary" style={{ flex: 1 }}>
                                    Start Chat
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default WhatsAppInbox;
