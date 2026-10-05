import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
    Mail, Inbox, Send, RefreshCw, Search, PlusCircle, 
    Trash2, Reply, CheckCircle2, User, Clock, ShieldCheck, 
    ExternalLink, Sparkles, X, ChevronRight, AlertOctagon,
    Copy, Check, ShieldAlert, RotateCcw, Key
} from 'lucide-react';

const EmailInbox = () => {
    const { api, socket, user } = useAuth();
    const toast = useToast();

    const isAdmin = ['master', 'admin', 'manager'].includes(user?.role);

    // Tabs: 'inbox' | 'sent' | 'spam' | 'trash'
    const [activeTab, setActiveTab] = useState('inbox');
    const [emails, setEmails] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [spamCount, setSpamCount] = useState(0);
    const [trashCount, setTrashCount] = useState(0);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Multi-User Isolation & Admin Switching
    const [filterUser, setFilterUser] = useState('all');
    const [teamMembers, setTeamMembers] = useState([]);
    const [myMailboxAddress, setMyMailboxAddress] = useState('');

    // Compose Modal
    const [composeOpen, setComposeOpen] = useState(false);
    const [composeTo, setComposeTo] = useState('');
    const [composeSubject, setComposeSubject] = useState('');
    const [composeBody, setComposeBody] = useState('');
    const [sendingEmail, setSendingEmail] = useState(false);

    // Reply Box
    const [replyText, setReplyText] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);

    // Fetch user metadata & team members
    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const { data } = await api.get('/email-settings');
                if (data?.emailUser) {
                    setMyMailboxAddress(data.emailUser);
                }
                if (isAdmin) {
                    const teamRes = await api.get('/email-settings/team');
                    setTeamMembers(Array.isArray(teamRes.data) ? teamRes.data : []);
                }
            } catch (err) {
                console.warn('[EMAIL INBOX] Metadata fetch warning:', err.message);
            }
        };
        fetchMeta();
    }, [isAdmin]);

    // Fetch emails for current tab & filter
    const fetchEmails = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (isAdmin && filterUser && filterUser !== 'all') {
                params.append('filterUser', filterUser);
            }
            const queryStr = params.toString() ? `?${params.toString()}` : '';

            let endpoint = `/email/${activeTab}`;
            const { data } = await api.get(`${endpoint}${queryStr}`);

            if (activeTab === 'inbox') {
                setEmails(data.emails || []);
                setUnreadCount(data.unreadCount || 0);
                setSpamCount(data.spamCount || 0);
                setTrashCount(data.trashCount || 0);
                if (!selectedEmail && data.emails && data.emails.length > 0) {
                    setSelectedEmail(data.emails[0]);
                }
            } else {
                const list = Array.isArray(data) ? data : (data.emails || []);
                setEmails(list);
                if (!selectedEmail && list && list.length > 0) {
                    setSelectedEmail(list[0]);
                }
            }
        } catch (err) {
            console.error('[EMAIL INBOX] Error fetching emails:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmails();
    }, [activeTab, searchQuery, filterUser]);

    // Real-time socket listener for incoming emails
    useEffect(() => {
        if (!socket) return;

        const handleNewEmail = (newMail) => {
            console.log('[SOCKET] New email received:', newMail.subject);
            
            if (newMail.verificationCode) {
                toast.success(`🔑 Verification Code Received: ${newMail.verificationCode} from ${newMail.fromName || newMail.from}`);
            } else {
                toast.info(`🔔 New Email from ${newMail.fromName || newMail.from}: "${newMail.subject}"`);
            }

            if (newMail.folder === 'spam') {
                setSpamCount(prev => prev + 1);
                if (activeTab === 'spam') {
                    setEmails(prev => [newMail, ...prev]);
                }
            } else {
                setUnreadCount(prev => prev + 1);
                if (activeTab === 'inbox') {
                    setEmails(prev => [newMail, ...prev]);
                }
            }
        };

        const handleEmailSent = (sentMail) => {
            if (activeTab === 'sent') {
                setEmails(prev => [sentMail, ...prev]);
            }
        };

        socket.on('new_email', handleNewEmail);
        socket.on('email_sent', handleEmailSent);

        return () => {
            socket.off('new_email', handleNewEmail);
            socket.off('email_sent', handleEmailSent);
        };
    }, [socket, activeTab]);

    // Select email & mark as read
    const handleSelectEmail = async (email) => {
        setSelectedEmail(email);
        if (!email.isRead && email.direction === 'inbound') {
            try {
                await api.put(`/email/${email._id}/read`);
                setEmails(prev => prev.map(e => e._id === email._id ? { ...e, isRead: true } : e));
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (e) {}
        }
    };

    // Move to Spam
    const handleMarkSpam = async (id) => {
        try {
            await api.put(`/email/${id}/spam`);
            setEmails(prev => prev.filter(e => e._id !== id));
            setSpamCount(prev => prev + 1);
            if (selectedEmail?._id === id) {
                const remaining = emails.filter(e => e._id !== id);
                setSelectedEmail(remaining[0] || null);
            }
            toast.success('Email moved to Spam folder');
        } catch (err) {
            toast.error('Failed to move email to Spam');
        }
    };

    // Restore from Spam
    const handleUnspam = async (id) => {
        try {
            await api.put(`/email/${id}/unspam`);
            setEmails(prev => prev.filter(e => e._id !== id));
            setSpamCount(prev => Math.max(0, prev - 1));
            if (selectedEmail?._id === id) {
                const remaining = emails.filter(e => e._id !== id);
                setSelectedEmail(remaining[0] || null);
            }
            toast.success('Email restored to Inbox');
        } catch (err) {
            toast.error('Failed to restore email to Inbox');
        }
    };

    // Move to Trash
    const handleMoveToTrash = async (id) => {
        try {
            await api.put(`/email/${id}/trash`);
            setEmails(prev => prev.filter(e => e._id !== id));
            setTrashCount(prev => prev + 1);
            if (selectedEmail?._id === id) {
                const remaining = emails.filter(e => e._id !== id);
                setSelectedEmail(remaining[0] || null);
            }
            toast.success('Email moved to Trash');
        } catch (err) {
            toast.error('Failed to move email to Trash');
        }
    };

    // Restore from Trash
    const handleRestore = async (id) => {
        try {
            const { data } = await api.put(`/email/${id}/restore`);
            setEmails(prev => prev.filter(e => e._id !== id));
            setTrashCount(prev => Math.max(0, prev - 1));
            if (selectedEmail?._id === id) {
                const remaining = emails.filter(e => e._id !== id);
                setSelectedEmail(remaining[0] || null);
            }
            toast.success(data.message || 'Email restored successfully');
        } catch (err) {
            toast.error('Failed to restore email');
        }
    };

    // Permanently Delete email
    const handlePermanentDelete = async (id) => {
        if (!window.confirm('Permanently delete this email? This cannot be undone.')) return;
        try {
            await api.delete(`/email/${id}`);
            setEmails(prev => prev.filter(e => e._id !== id));
            if (activeTab === 'trash') {
                setTrashCount(prev => Math.max(0, prev - 1));
            }
            if (selectedEmail?._id === id) {
                const remaining = emails.filter(e => e._id !== id);
                setSelectedEmail(remaining[0] || null);
            }
            toast.success('Email permanently deleted');
        } catch (err) {
            toast.error('Failed to delete email');
        }
    };

    // Send new compose email
    const handleSendCompose = async (e) => {
        e?.preventDefault();
        if (!composeTo || !composeSubject || !composeBody) {
            toast.error('Recipient, Subject, and Body are required.');
            return;
        }

        setSendingEmail(true);
        try {
            const { data } = await api.post('/email/send', {
                to: composeTo,
                subject: composeSubject,
                text: composeBody,
                html: `<div style="font-family: sans-serif; line-height: 1.6; color: #1f2937;">${composeBody.replace(/\n/g, '<br/>')}</div>`
            });

            toast.success('Email sent successfully!');
            setComposeOpen(false);
            setComposeTo('');
            setComposeSubject('');
            setComposeBody('');

            if (activeTab === 'sent') {
                setEmails(prev => [data.email, ...prev]);
                setSelectedEmail(data.email);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send email. Check Email Settings.');
        } finally {
            setSendingEmail(false);
        }
    };

    // Send quick reply
    const handleSendReply = async () => {
        if (!replyText.trim() || !selectedEmail) return;

        setSendingReply(true);
        try {
            const replySubject = selectedEmail.subject.startsWith('Re:') 
                ? selectedEmail.subject 
                : `Re: ${selectedEmail.subject}`;

            const { data } = await api.post('/email/send', {
                to: selectedEmail.from,
                subject: replySubject,
                text: replyText,
                html: `<div style="font-family: sans-serif; line-height: 1.6; color: #1f2937;">${replyText.replace(/\n/g, '<br/>')}</div>`,
                leadId: selectedEmail.leadId?._id || selectedEmail.leadId || null
            });

            toast.success(`Reply sent to ${selectedEmail.from}!`);
            setReplyText('');

            if (activeTab === 'sent') {
                setEmails(prev => [data.email, ...prev]);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send reply. Verify your SMTP settings.');
        } finally {
            setSendingReply(false);
        }
    };

    const copyCode = (code) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(true);
        toast.success(`Verification code ${code} copied!`);
        setTimeout(() => setCopiedCode(false), 2000);
    };

    const formatEmailTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    return (
        <div className="animate-fade-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
            {/* Top Toolbar */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0 }}>Domain Mailbox</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', margin: '4px 0 0 0' }}>
                            Send & receive emails, OTP verification codes, and client inquiries on your custom domain
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Logged in mailbox status */}
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        background: 'rgba(255, 255, 255, 0.05)', 
                        padding: '7px 14px', 
                        borderRadius: '20px', 
                        border: '1px solid var(--border-color)', 
                        fontSize: '12.5px' 
                    }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: myMailboxAddress ? '#10b981' : '#f87171' }}></span>
                        <span style={{ color: 'var(--text-secondary)' }}>Mailbox:</span>
                        <span style={{ color: '#fff', fontWeight: 600, fontFamily: myMailboxAddress ? 'monospace' : 'inherit' }}>
                            {myMailboxAddress || 'Not Configured'}
                        </span>
                    </div>

                    <button 
                        onClick={() => setComposeOpen(true)}
                        className="btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '13.5px' }}
                    >
                        <PlusCircle size={16} />
                        <span>Compose Email</span>
                    </button>
                    <button 
                        onClick={fetchEmails}
                        className="btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13.5px' }}
                        title="Refresh Mailbox"
                    >
                        <RefreshCw size={15} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </header>

            {/* Mailbox Main Layout (Two Pane) */}
            <div className="glass-panel" style={{ flexGrow: 1, display: 'flex', overflow: 'hidden', padding: 0 }}>
                
                {/* Left Column: Folders & Email List */}
                <div style={{ width: '380px', flexShrink: 0, borderRight: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column' }}>
                    
                    {/* Folder Tabs & Search */}
                    <div style={{ padding: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        {/* Admin Mailbox Filter Dropdown */}
                        {isAdmin && (
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                                    Viewing Mailbox
                                </label>
                                <select
                                    value={filterUser}
                                    onChange={(e) => {
                                        setFilterUser(e.target.value);
                                        setSelectedEmail(null);
                                    }}
                                    className="form-input"
                                    style={{
                                        width: '100%',
                                        padding: '7px 10px',
                                        fontSize: '12.5px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        color: '#fff'
                                    }}
                                >
                                    <option value="all" style={{ background: '#1e1b4b' }}>🌐 All Team Mailboxes</option>
                                    {teamMembers.map((m) => (
                                        <option key={m.userId} value={m.userId} style={{ background: '#1e1b4b' }}>
                                            {m.name} ({m.domainEmail !== 'Not Configured' ? m.domainEmail : 'No Domain'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Four Folder Buttons */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '14px' }}>
                            <button
                                onClick={() => { setActiveTab('inbox'); setSelectedEmail(null); }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    padding: '8px 4px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '11.5px',
                                    background: activeTab === 'inbox' ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.05)',
                                    color: activeTab === 'inbox' ? '#fff' : 'var(--text-secondary)'
                                }}
                            >
                                <Inbox size={15} />
                                <span>Inbox</span>
                                {unreadCount > 0 && (
                                    <span style={{
                                        background: activeTab === 'inbox' ? '#fff' : 'var(--accent-color)',
                                        color: activeTab === 'inbox' ? 'var(--accent-color)' : '#fff',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        padding: '0 5px',
                                        borderRadius: '8px'
                                    }}>
                                        {unreadCount}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => { setActiveTab('sent'); setSelectedEmail(null); }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    padding: '8px 4px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '11.5px',
                                    background: activeTab === 'sent' ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.05)',
                                    color: activeTab === 'sent' ? '#fff' : 'var(--text-secondary)'
                                }}
                            >
                                <Send size={15} />
                                <span>Sent</span>
                            </button>

                            <button
                                onClick={() => { setActiveTab('spam'); setSelectedEmail(null); }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    padding: '8px 4px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '11.5px',
                                    background: activeTab === 'spam' ? '#ea580c' : 'rgba(255, 255, 255, 0.05)',
                                    color: activeTab === 'spam' ? '#fff' : 'var(--text-secondary)'
                                }}
                            >
                                <AlertOctagon size={15} />
                                <span>Spam</span>
                                {spamCount > 0 && (
                                    <span style={{
                                        background: activeTab === 'spam' ? '#fff' : '#ea580c',
                                        color: activeTab === 'spam' ? '#ea580c' : '#fff',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        padding: '0 5px',
                                        borderRadius: '8px'
                                    }}>
                                        {spamCount}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => { setActiveTab('trash'); setSelectedEmail(null); }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    padding: '8px 4px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '11.5px',
                                    background: activeTab === 'trash' ? '#dc2626' : 'rgba(255, 255, 255, 0.05)',
                                    color: activeTab === 'trash' ? '#fff' : 'var(--text-secondary)'
                                }}
                            >
                                <Trash2 size={15} />
                                <span>Trash</span>
                                {trashCount > 0 && (
                                    <span style={{
                                        background: activeTab === 'trash' ? '#fff' : '#dc2626',
                                        color: activeTab === 'trash' ? '#dc2626' : '#fff',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        padding: '0 5px',
                                        borderRadius: '8px'
                                    }}>
                                        {trashCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div style={{ position: 'relative' }}>
                            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                            <input
                                type="text"
                                placeholder={`Search ${activeTab}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px 8px 36px',
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                    fontSize: '12.5px',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    {/* Email List Items */}
                    <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                        {loading ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
                                <RefreshCw size={20} className="spin" style={{ marginBottom: '8px', animation: 'spin 1.5s linear infinite' }} />
                                <p style={{ fontSize: '13px' }}>Loading emails...</p>
                            </div>
                        ) : emails.length === 0 ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
                                <Mail size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                                <p style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    {activeTab === 'inbox' ? 'Inbox is empty' : activeTab === 'sent' ? 'No sent emails' : activeTab === 'spam' ? 'No spam emails' : 'Trash is empty'}
                                </p>
                                <p style={{ fontSize: '12px', maxWidth: '240px', margin: '6px auto 0' }}>
                                    {activeTab === 'inbox' 
                                        ? 'Emails & verification codes sent to your custom domain will automatically appear here in real-time.' 
                                        : activeTab === 'spam'
                                            ? 'Suspicious or junk emails automatically filtered away from your primary inbox.'
                                            : activeTab === 'trash'
                                                ? 'Deleted emails are kept here until permanently purged.'
                                                : 'Outreach emails sent from the CRM will be logged here.'}
                                </p>
                            </div>
                        ) : (
                            emails.map((email) => {
                                const isSelected = selectedEmail?._id === email._id;
                                const isUnread = !email.isRead && email.direction === 'inbound';

                                return (
                                    <div
                                        key={email._id}
                                        onClick={() => handleSelectEmail(email)}
                                        style={{
                                            padding: '14px 16px',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                            background: isSelected 
                                                ? 'rgba(139, 92, 246, 0.12)' 
                                                : isUnread 
                                                    ? 'rgba(255, 255, 255, 0.03)' 
                                                    : 'transparent',
                                            borderLeft: isSelected 
                                                ? '3px solid var(--accent-color)' 
                                                : isUnread 
                                                    ? '3px solid #3b82f6' 
                                                    : '3px solid transparent',
                                            transition: 'background 0.15s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{
                                                fontWeight: isUnread ? 700 : 600,
                                                fontSize: '13px',
                                                color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                maxWidth: '220px'
                                            }}>
                                                {activeTab === 'sent' ? `To: ${email.to}` : (email.fromName || email.from)}
                                            </span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-dim)', flexShrink: 0 }}>
                                                {formatEmailTime(email.createdAt)}
                                            </span>
                                        </div>

                                        <p style={{
                                            margin: '0 0 4px 0',
                                            fontWeight: isUnread ? 700 : 500,
                                            fontSize: '13px',
                                            color: isUnread ? '#fff' : 'var(--text-primary)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {email.subject || '(No Subject)'}
                                        </p>

                                        <p style={{
                                            margin: 0,
                                            fontSize: '12px',
                                            color: 'var(--text-dim)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {email.verificationCode ? `🔑 Code: ${email.verificationCode} - ` : ''}
                                            {email.text ? email.text.substring(0, 80) : '(Empty email content)'}
                                        </p>

                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                                            {email.verificationCode && (
                                                <span style={{
                                                    fontSize: '10px',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    background: 'rgba(16, 185, 129, 0.2)',
                                                    color: '#34d399',
                                                    fontWeight: 700,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '3px'
                                                }}>
                                                    <Key size={10} /> OTP: {email.verificationCode}
                                                </span>
                                            )}

                                            {email.leadId && (
                                                <span style={{
                                                    fontSize: '10.5px',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    background: 'rgba(16, 185, 129, 0.12)',
                                                    color: '#10b981',
                                                    fontWeight: 600
                                                }}>
                                                    Lead: {email.leadId.name || 'Client'}
                                                </span>
                                            )}

                                            {isAdmin && filterUser === 'all' && email.userId && (
                                                <span style={{
                                                    fontSize: '10px',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    background: 'rgba(139, 92, 246, 0.15)',
                                                    color: '#c4b5fd',
                                                    fontWeight: 600
                                                }}>
                                                    👤 {email.userId.name || email.userId.email}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Column: Email Reader Pane */}
                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {selectedEmail ? (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            {/* Email Header Card */}
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                                        {selectedEmail.subject || '(No Subject)'}
                                    </h2>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {activeTab === 'spam' ? (
                                            <button 
                                                onClick={() => handleUnspam(selectedEmail._id)}
                                                className="btn-secondary"
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
                                                title="Mark as Not Spam (Move to Inbox)"
                                            >
                                                <CheckCircle2 size={14} style={{ color: '#10b981' }} />
                                                <span>Not Spam</span>
                                            </button>
                                        ) : activeTab === 'trash' ? (
                                            <button 
                                                onClick={() => handleRestore(selectedEmail._id)}
                                                className="btn-secondary"
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
                                                title="Restore email to Inbox"
                                            >
                                                <RotateCcw size={14} style={{ color: '#38bdf8' }} />
                                                <span>Restore</span>
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleMarkSpam(selectedEmail._id)}
                                                className="btn-secondary"
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
                                                title="Move to Spam"
                                            >
                                                <ShieldAlert size={14} style={{ color: '#f97316' }} />
                                                <span>Report Spam</span>
                                            </button>
                                        )}

                                        {activeTab === 'trash' ? (
                                            <button 
                                                onClick={() => handlePermanentDelete(selectedEmail._id)}
                                                style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                title="Permanently Delete"
                                            >
                                                <Trash2 size={14} />
                                                <span>Delete Forever</span>
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleMoveToTrash(selectedEmail._id)}
                                                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
                                                title="Move to Trash"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#fff',
                                        fontWeight: 700,
                                        fontSize: '15px'
                                    }}>
                                        {(selectedEmail.fromName || selectedEmail.from)[0].toUpperCase()}
                                    </div>
                                    <div style={{ flexGrow: 1 }}>
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>
                                            {selectedEmail.fromName} <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: '13px' }}>&lt;{selectedEmail.from}&gt;</span>
                                        </p>
                                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            To: {selectedEmail.to} • {new Date(selectedEmail.createdAt).toLocaleString()}
                                        </p>
                                    </div>

                                    {selectedEmail.leadId && (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '6px 12px',
                                            borderRadius: '8px',
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            border: '1px solid rgba(16, 185, 129, 0.25)',
                                            fontSize: '12px',
                                            color: '#10b981'
                                        }}>
                                            <CheckCircle2 size={14} />
                                            <span>Lead: <b>{selectedEmail.leadId.name}</b></span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* OTP / Verification Code Banner (Google, etc.) */}
                            {selectedEmail.verificationCode && (
                                <div style={{ 
                                    margin: '16px 24px 0 24px', 
                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(16, 185, 129, 0.15))', 
                                    border: '1px solid #6366f1', 
                                    borderRadius: '12px', 
                                    padding: '16px 20px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between' 
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>
                                            <Key size={22} />
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, color: 'var(--accent-color)' }}>
                                                Security Verification Code Detected
                                            </span>
                                            <div style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '4px', color: '#fff', fontFamily: 'monospace', marginTop: '2px' }}>
                                                {selectedEmail.verificationCode}
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => copyCode(selectedEmail.verificationCode)} 
                                        className="btn-primary" 
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', fontSize: '13px' }}
                                    >
                                        {copiedCode ? <Check size={16} /> : <Copy size={16} />}
                                        <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                                    </button>
                                </div>
                            )}

                            {/* Email HTML / Text Body */}
                            <div style={{ flexGrow: 1, padding: '24px', overflowY: 'auto', background: 'rgba(0,0,0,0.1)' }}>
                                {selectedEmail.html ? (
                                    <div 
                                        style={{
                                            background: '#ffffff',
                                            color: '#1f2937',
                                            padding: '24px',
                                            borderRadius: '12px',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                            lineHeight: 1.6,
                                            fontSize: '14.5px',
                                            overflowX: 'auto'
                                        }}
                                        dangerouslySetInnerHTML={{ __html: selectedEmail.html }} 
                                    />
                                ) : (
                                    <div style={{
                                        whiteSpace: 'pre-wrap',
                                        fontSize: '14px',
                                        lineHeight: 1.6,
                                        color: 'var(--text-primary)',
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        padding: '20px',
                                        borderRadius: '10px'
                                    }}>
                                        {selectedEmail.text}
                                    </div>
                                )}
                            </div>

                            {/* Quick Reply Box */}
                            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.02)' }}>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <textarea
                                        rows="2"
                                        placeholder={`Reply to ${selectedEmail.from}...`}
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        style={{
                                            flexGrow: 1,
                                            padding: '10px 14px',
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '8px',
                                            color: 'var(--text-primary)',
                                            fontSize: '13px',
                                            resize: 'none',
                                            outline: 'none'
                                        }}
                                    />
                                    <button
                                        onClick={handleSendReply}
                                        disabled={sendingReply || !replyText.trim()}
                                        className="btn-primary"
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 20px', fontSize: '13px' }}
                                    >
                                        {sendingReply ? (
                                            <RefreshCw size={15} className="spin" />
                                        ) : (
                                            <>
                                                <Reply size={15} />
                                                <span>Send</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>
                            <Mail size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>No Email Selected</h3>
                            <p style={{ fontSize: '13px', maxWidth: '300px', textAlign: 'center', marginTop: '6px' }}>
                                Select an email from the left to read messages, verify codes, or reply directly.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Compose Email Modal */}
            {composeOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(6px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div className="glass-panel animate-scale-up" style={{ width: '600px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Send size={18} style={{ color: 'var(--accent-color)' }} />
                                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#fff' }}>Compose Direct Email</h3>
                            </div>
                            <button onClick={() => setComposeOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                                <X size={18} />
                            </button>
                        </div>

                        {myMailboxAddress && (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '6px' }}>
                                Sending from: <strong style={{ color: '#a78bfa' }}>{myMailboxAddress}</strong>
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Recipient Email</label>
                            <input
                                type="email"
                                required
                                placeholder="client@company.com"
                                value={composeTo}
                                onChange={(e) => setComposeTo(e.target.value)}
                                className="form-input"
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Subject</label>
                            <input
                                type="text"
                                required
                                placeholder="Meeting Follow-up / Project Proposal"
                                value={composeSubject}
                                onChange={(e) => setComposeSubject(e.target.value)}
                                className="form-input"
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Message Body</label>
                            <textarea
                                rows="6"
                                required
                                placeholder="Write your email here..."
                                value={composeBody}
                                onChange={(e) => setComposeBody(e.target.value)}
                                className="form-input"
                                style={{ resize: 'vertical' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                            <button onClick={() => setComposeOpen(false)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                                Cancel
                            </button>
                            <button onClick={handleSendCompose} disabled={sendingEmail} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', fontSize: '13px' }}>
                                {sendingEmail ? <RefreshCw size={15} className="spin" /> : <Send size={15} />}
                                <span>{sendingEmail ? 'Dispatching...' : 'Send Email'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmailInbox;
