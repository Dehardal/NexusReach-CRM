import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
    Mail, Inbox, Send, RefreshCw, Search, PlusCircle, 
    Trash2, Reply, CheckCircle2, User, Clock, ShieldCheck, 
    ExternalLink, Sparkles, X, ChevronRight, AlertOctagon,
    Copy, Check, ShieldAlert, RotateCcw, Key, Star, Forward,
    Printer, MailOpen, Filter
} from 'lucide-react';
import CustomDropdown from '../components/CustomDropdown';

const EmailInbox = () => {
    const { api, socket, user } = useAuth();
    const toast = useToast();

    const isAdmin = ['master', 'admin', 'manager'].includes(user?.role);

    // Tabs: 'inbox' | 'starred' | 'sent' | 'spam' | 'trash'
    const [activeTab, setActiveTab] = useState('inbox');
    const [emails, setEmails] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [starredCount, setStarredCount] = useState(0);
    const [spamCount, setSpamCount] = useState(0);
    const [trashCount, setTrashCount] = useState(0);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [onlyUnread, setOnlyUnread] = useState(false);
    const [syncingHostinger, setSyncingHostinger] = useState(false);

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
                setStarredCount(data.starredCount || 0);
                setSpamCount(data.spamCount || 0);
                setTrashCount(data.trashCount || 0);
                if (!selectedEmail && data.emails && data.emails.length > 0) {
                    setSelectedEmail(data.emails[0]);
                }
            } else {
                const list = Array.isArray(data) ? data : (data.emails || []);
                setEmails(list);
                if (data.starredCount !== undefined) setStarredCount(data.starredCount);
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

    // Toggle Starred
    const handleToggleStar = async (id, e) => {
        e?.stopPropagation();
        try {
            const { data } = await api.put(`/email/${id}/star`);
            setEmails(prev => prev.map(m => m._id === id ? { ...m, isStarred: data.isStarred } : m));
            if (selectedEmail?._id === id) {
                setSelectedEmail(prev => ({ ...prev, isStarred: data.isStarred }));
            }
            setStarredCount(prev => data.isStarred ? prev + 1 : Math.max(0, prev - 1));
            if (activeTab === 'starred' && !data.isStarred) {
                setEmails(prev => prev.filter(m => m._id !== id));
            }
            toast.success(data.isStarred ? 'Conversation starred ⭐' : 'Conversation unstarred');
        } catch (err) {
            toast.error('Failed to update star');
        }
    };

    // Toggle Read / Unread
    const handleToggleUnread = async (email, e) => {
        e?.stopPropagation();
        try {
            const willBeRead = !email.isRead;
            if (willBeRead) {
                await api.put(`/email/${email._id}/read`);
                setUnreadCount(prev => Math.max(0, prev - 1));
                toast.success('Marked as read');
            } else {
                await api.put(`/email/${email._id}/unread`);
                setUnreadCount(prev => prev + 1);
                toast.success('Marked as unread');
            }
            setEmails(prev => prev.map(m => m._id === email._id ? { ...m, isRead: willBeRead } : m));
            if (selectedEmail?._id === email._id) {
                setSelectedEmail(prev => ({ ...prev, isRead: willBeRead }));
            }
        } catch (err) {
            toast.error('Failed to update read status');
        }
    };

    // Forward Email
    const handleForward = () => {
        if (!selectedEmail) return;
        setComposeTo('');
        setComposeSubject(selectedEmail.subject?.startsWith('Fwd:') ? selectedEmail.subject : `Fwd: ${selectedEmail.subject || ''}`);
        const forwardHeader = `\n\n---------- Forwarded message ---------\nFrom: ${selectedEmail.fromName || selectedEmail.from} <${selectedEmail.from}>\nDate: ${new Date(selectedEmail.createdAt).toLocaleString()}\nSubject: ${selectedEmail.subject || ''}\nTo: ${selectedEmail.to}\n\n`;
        setComposeBody(forwardHeader + (selectedEmail.text || ''));
        setComposeOpen(true);
    };

    // Print Email
    const handlePrint = () => {
        window.print();
    };

    // Live Sync with Hostinger (both Inboxes and Sent folders)
    const handleSyncHostinger = async () => {
        setSyncingHostinger(true);
        try {
            const { data } = await api.post('/mailboxes/sync-inbox');
            toast.success(data.message || 'Hostinger webmail inboxes & sent folders synced!');
            await fetchEmails();
        } catch (err) {
            await fetchEmails();
            toast.info('Mailbox refreshed');
        } finally {
            setSyncingHostinger(false);
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
        <div className="mail-fullpage animate-fade-in">
            {/* Sleek Integrated Top Bar */}
            <header className="mail-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'rgba(124, 58, 237, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-color)'
                    }}>
                        <Inbox size={18} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h1 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                                Domain Mailbox
                            </h1>
                            <span style={{
                                fontSize: '11px',
                                padding: '1px 8px',
                                borderRadius: '12px',
                                background: 'rgba(16, 185, 129, 0.1)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                fontWeight: 600
                            }}>
                                Live Sync
                            </span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Logged in mailbox status */}
                    <div className="mail-status-pill" style={{ padding: '5px 12px', fontSize: '12px' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: myMailboxAddress ? '#10b981' : '#f87171', flexShrink: 0 }}></span>
                        <span style={{ color: 'var(--text-secondary)' }}>Mailbox:</span>
                        <span className="mail-status-pill-val" style={{ fontFamily: myMailboxAddress ? 'monospace' : 'inherit', fontSize: '12px' }}>
                            {myMailboxAddress || 'Not Configured'}
                        </span>
                    </div>

                    <button 
                        onClick={() => setComposeOpen(true)}
                        className="btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '13px' }}
                    >
                        <PlusCircle size={15} />
                        <span>Compose Email</span>
                    </button>
                    <button 
                        onClick={handleSyncHostinger}
                        disabled={syncingHostinger}
                        className="btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', fontSize: '13px' }}
                        title="Sync directly with Hostinger Webmail (both incoming emails & emails sent from mail.hostinger.com)"
                    >
                        <RefreshCw size={14} className={syncingHostinger ? 'spin' : ''} />
                        <span>{syncingHostinger ? 'Syncing...' : 'Sync Webmail'}</span>
                    </button>
                    <button 
                        onClick={fetchEmails}
                        className="btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', fontSize: '13px' }}
                        title="Refresh Mailbox"
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </header>

            {/* Mailbox Main Two-Pane Layout - Edge to Edge */}
            <div className="mail-workspace">
                <div className="mail-container">
                
                {/* Left Column: Folders & Email List */}
                <div className="mail-sidebar">
                    
                    {/* Folder Tabs & Search */}
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        {/* Admin Mailbox Filter Dropdown */}
                        {isAdmin && (
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                                    Viewing Mailbox
                                </label>
                                <CustomDropdown
                                    value={filterUser}
                                    onChange={(val) => {
                                        setFilterUser(val);
                                        setSelectedEmail(null);
                                    }}
                                    options={[
                                        { value: 'all', label: 'All Team Mailboxes', icon: '🌐' },
                                        ...teamMembers.map((m) => ({
                                            value: m.userId,
                                            label: `${m.name} (${m.domainEmail !== 'Not Configured' ? m.domainEmail : 'No Domain'})`,
                                            icon: '✉️'
                                        }))
                                    ]}
                                    width="100%"
                                />
                            </div>
                        )}

                        {/* Five Folder Buttons (Inbox, Starred, Sent, Spam, Trash) */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginBottom: '14px' }}>
                            <button
                                onClick={() => { setActiveTab('inbox'); setSelectedEmail(null); }}
                                className={`mail-folder-btn ${activeTab === 'inbox' ? 'active' : ''}`}
                            >
                                <Inbox size={14} />
                                <span>Inbox</span>
                                {unreadCount > 0 && (
                                    <span style={{
                                        background: activeTab === 'inbox' ? 'rgba(255, 255, 255, 0.25)' : 'var(--accent-color)',
                                        color: '#fff',
                                        fontSize: '9.5px',
                                        fontWeight: 700,
                                        padding: '0 4px',
                                        borderRadius: '8px'
                                    }}>
                                        {unreadCount}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => { setActiveTab('starred'); setSelectedEmail(null); }}
                                className={`mail-folder-btn ${activeTab === 'starred' ? 'active-starred' : ''}`}
                            >
                                <Star size={14} fill={activeTab === 'starred' ? '#fff' : 'none'} />
                                <span>Starred</span>
                                {starredCount > 0 && (
                                    <span style={{
                                        background: activeTab === 'starred' ? 'rgba(255, 255, 255, 0.25)' : '#f59e0b',
                                        color: '#fff',
                                        fontSize: '9.5px',
                                        fontWeight: 700,
                                        padding: '0 4px',
                                        borderRadius: '8px'
                                    }}>
                                        {starredCount}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => { setActiveTab('sent'); setSelectedEmail(null); }}
                                className={`mail-folder-btn ${activeTab === 'sent' ? 'active' : ''}`}
                            >
                                <Send size={14} />
                                <span>Sent</span>
                            </button>

                            <button
                                onClick={() => { setActiveTab('spam'); setSelectedEmail(null); }}
                                className={`mail-folder-btn ${activeTab === 'spam' ? 'active-spam' : ''}`}
                            >
                                <AlertOctagon size={14} />
                                <span>Spam</span>
                                {spamCount > 0 && (
                                    <span style={{
                                        background: activeTab === 'spam' ? 'rgba(255, 255, 255, 0.25)' : '#ea580c',
                                        color: '#fff',
                                        fontSize: '9.5px',
                                        fontWeight: 700,
                                        padding: '0 4px',
                                        borderRadius: '8px'
                                    }}>
                                        {spamCount}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => { setActiveTab('trash'); setSelectedEmail(null); }}
                                className={`mail-folder-btn ${activeTab === 'trash' ? 'active-trash' : ''}`}
                            >
                                <Trash2 size={14} />
                                <span>Trash</span>
                                {trashCount > 0 && (
                                    <span style={{
                                        background: activeTab === 'trash' ? 'rgba(255, 255, 255, 0.25)' : '#dc2626',
                                        color: '#fff',
                                        fontSize: '9.5px',
                                        fontWeight: 700,
                                        padding: '0 4px',
                                        borderRadius: '8px'
                                    }}>
                                        {trashCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Search Bar & Unread Filter */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div className="mail-search-box" style={{ flexGrow: 1 }}>
                                <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
                                <input
                                    type="text"
                                    className="mail-search-input"
                                    placeholder={`Search ${activeTab}...`}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={() => setOnlyUnread(!onlyUnread)}
                                style={{
                                    background: onlyUnread ? 'var(--accent-color)' : 'var(--bg-secondary)',
                                    color: onlyUnread ? '#fff' : 'var(--text-secondary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    padding: '0 10px',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    height: '36px',
                                    flexShrink: 0,
                                    transition: 'all 0.15s ease'
                                }}
                                title="Filter unread emails only"
                            >
                                <Filter size={13} />
                                <span>{onlyUnread ? 'Unread' : 'All'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Email List Items */}
                    <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                        {(() => {
                            const displayedEmails = onlyUnread ? emails.filter(e => !e.isRead) : emails;
                            if (loading) {
                                return (
                                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
                                        <RefreshCw size={22} className="spin" style={{ marginBottom: '8px', opacity: 0.7 }} />
                                        <p style={{ fontSize: '13px' }}>Loading messages...</p>
                                    </div>
                                );
                            }
                            if (displayedEmails.length === 0) {
                                return (
                                    <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-dim)' }}>
                                        <Mail size={36} style={{ opacity: 0.25, marginBottom: '10px' }} />
                                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {onlyUnread ? 'No unread messages' : activeTab === 'inbox' ? 'Inbox is empty' : activeTab === 'starred' ? 'No starred emails' : activeTab === 'sent' ? 'No sent emails' : activeTab === 'spam' ? 'No spam emails' : 'Trash is empty'}
                                        </p>
                                        <p style={{ fontSize: '12px', maxWidth: '240px', margin: '6px auto 0', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                            {onlyUnread 
                                                ? 'All emails in this folder have been read.'
                                                : activeTab === 'starred'
                                                    ? 'Star important emails to quickly access them here anytime.'
                                                    : activeTab === 'inbox' 
                                                        ? 'Emails & verification codes sent to your custom domain will automatically appear here in real-time.' 
                                                        : activeTab === 'spam'
                                                            ? 'Suspicious or junk emails automatically filtered away from your primary inbox.'
                                                            : activeTab === 'trash'
                                                                ? 'Deleted emails are kept here until permanently purged.'
                                                                : 'Outreach emails sent from the CRM will be logged here.'}
                                        </p>
                                    </div>
                                );
                            }
                            return displayedEmails.map((email) => {
                                const isSelected = selectedEmail?._id === email._id;
                                const isUnread = !email.isRead && email.direction === 'inbound';

                                return (
                                    <div
                                        key={email._id}
                                        onClick={() => handleSelectEmail(email)}
                                        className={`mail-item ${isSelected ? 'selected' : ''}`}
                                    >
                                        {/* Top row: Star + Sender + Timestamp */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                                <button
                                                    onClick={(e) => handleToggleStar(email._id, e)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        padding: '0',
                                                        cursor: 'pointer',
                                                        color: email.isStarred ? '#f59e0b' : 'var(--text-dim)',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0
                                                    }}
                                                    title={email.isStarred ? 'Unstar conversation' : 'Star conversation'}
                                                >
                                                    <Star size={13} fill={email.isStarred ? '#f59e0b' : 'none'} />
                                                </button>
                                                {isUnread && (
                                                    <span style={{ 
                                                        width: '7px', 
                                                        height: '7px', 
                                                        borderRadius: '50%', 
                                                        background: 'var(--accent-color)', 
                                                        flexShrink: 0,
                                                        boxShadow: '0 0 6px var(--accent-color)'
                                                    }} />
                                                )}
                                                <span style={{
                                                    fontWeight: isUnread ? 700 : 600,
                                                    fontSize: '13px',
                                                    color: 'var(--text-primary)',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    maxWidth: '200px'
                                                }}>
                                                    {activeTab === 'sent' ? `To: ${email.to}` : (email.fromName || email.from)}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: '11px', color: 'var(--text-dim)', flexShrink: 0 }}>
                                                {formatEmailTime(email.createdAt)}
                                            </span>
                                        </div>

                                        {/* Subject line */}
                                        <p style={{
                                            margin: '0 0 4px 0',
                                            fontWeight: isUnread ? 700 : 500,
                                            fontSize: '13px',
                                            color: 'var(--text-primary)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {email.subject || '(No Subject)'}
                                        </p>

                                        {/* Snippet preview */}
                                        <p style={{
                                            margin: 0,
                                            fontSize: '12px',
                                            color: 'var(--text-secondary)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            lineHeight: 1.4
                                        }}>
                                            {email.verificationCode ? `🔑 Code: ${email.verificationCode} - ` : ''}
                                            {email.text ? email.text.substring(0, 80) : '(Empty email content)'}
                                        </p>

                                        {/* Tag pills */}
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                                            {email.verificationCode && (
                                                <span style={{
                                                    fontSize: '10px',
                                                    padding: '2px 7px',
                                                    borderRadius: '4px',
                                                    background: 'rgba(16, 185, 129, 0.12)',
                                                    color: '#10b981',
                                                    border: '1px solid rgba(16, 185, 129, 0.25)',
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
                                                    padding: '2px 7px',
                                                    borderRadius: '4px',
                                                    background: 'rgba(59, 130, 246, 0.12)',
                                                    color: '#3b82f6',
                                                    border: '1px solid rgba(59, 130, 246, 0.25)',
                                                    fontWeight: 600
                                                }}>
                                                    Lead: {email.leadId.name || 'Client'}
                                                </span>
                                            )}

                                            {isAdmin && filterUser === 'all' && email.userId && (
                                                <span style={{
                                                    fontSize: '10px',
                                                    padding: '2px 7px',
                                                    borderRadius: '4px',
                                                    background: 'rgba(139, 92, 246, 0.12)',
                                                    color: 'var(--accent-color)',
                                                    border: '1px solid rgba(139, 92, 246, 0.25)',
                                                    fontWeight: 600
                                                }}>
                                                    👤 {email.userId.name || email.userId.email}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>

                {/* Right Column: Email Reader Pane */}
                <div className="mail-reading-pane">
                    {selectedEmail ? (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                            {/* Email Header Card */}
                            <div className="mail-header-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '16px' }}>
                                    <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                                        {selectedEmail.subject || '(No Subject)'}
                                    </h2>

                                    {/* Action Buttons Toolbar */}
                                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
                                        {/* Star Toggle */}
                                        <button 
                                            onClick={(e) => handleToggleStar(selectedEmail._id, e)}
                                            className="btn-secondary"
                                            style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '6px', 
                                                fontSize: '12px', 
                                                padding: '6px 10px',
                                                color: selectedEmail.isStarred ? '#f59e0b' : 'var(--text-secondary)'
                                            }}
                                            title={selectedEmail.isStarred ? 'Unstar email' : 'Star email'}
                                        >
                                            <Star size={14} fill={selectedEmail.isStarred ? '#f59e0b' : 'none'} />
                                            <span>{selectedEmail.isStarred ? 'Starred' : 'Star'}</span>
                                        </button>

                                        {/* Mark Read / Unread */}
                                        <button 
                                            onClick={(e) => handleToggleUnread(selectedEmail, e)}
                                            className="btn-secondary"
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 10px' }}
                                            title={selectedEmail.isRead ? 'Mark as Unread' : 'Mark as Read'}
                                        >
                                            <MailOpen size={14} />
                                            <span>{selectedEmail.isRead ? 'Mark Unread' : 'Mark Read'}</span>
                                        </button>

                                        {/* Forward */}
                                        <button 
                                            onClick={handleForward}
                                            className="btn-secondary"
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 10px' }}
                                            title="Forward email"
                                        >
                                            <Forward size={14} />
                                            <span>Forward</span>
                                        </button>

                                        {/* Print */}
                                        <button 
                                            onClick={handlePrint}
                                            className="btn-secondary"
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 10px' }}
                                            title="Print email"
                                        >
                                            <Printer size={14} />
                                            <span>Print</span>
                                        </button>

                                        {activeTab === 'spam' ? (
                                            <button 
                                                onClick={() => handleUnspam(selectedEmail._id)}
                                                className="btn-secondary"
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 10px' }}
                                                title="Mark as Not Spam (Move to Inbox)"
                                            >
                                                <CheckCircle2 size={14} style={{ color: '#10b981' }} />
                                                <span>Not Spam</span>
                                            </button>
                                        ) : activeTab === 'trash' ? (
                                            <button 
                                                onClick={() => handleRestore(selectedEmail._id)}
                                                className="btn-secondary"
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 10px' }}
                                                title="Restore email to Inbox"
                                            >
                                                <RotateCcw size={14} style={{ color: '#38bdf8' }} />
                                                <span>Restore</span>
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleMarkSpam(selectedEmail._id)}
                                                className="btn-secondary"
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 10px' }}
                                                title="Move to Spam"
                                            >
                                                <ShieldAlert size={14} style={{ color: '#f97316' }} />
                                                <span>Spam</span>
                                            </button>
                                        )}

                                        {activeTab === 'trash' ? (
                                            <button 
                                                onClick={() => handlePermanentDelete(selectedEmail._id)}
                                                style={{ 
                                                    background: 'rgba(239, 68, 68, 0.12)', 
                                                    border: '1px solid rgba(239, 68, 68, 0.3)', 
                                                    color: '#ef4444', 
                                                    cursor: 'pointer', 
                                                    padding: '6px 10px', 
                                                    borderRadius: '6px', 
                                                    fontSize: '12px', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '6px',
                                                    fontWeight: 600
                                                }}
                                                title="Permanently Delete"
                                            >
                                                <Trash2 size={14} />
                                                <span>Delete Forever</span>
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleMoveToTrash(selectedEmail._id)}
                                                className="btn-secondary"
                                                style={{ color: '#ef4444', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                title="Move to Trash"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Sender Details Row */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '42px',
                                        height: '42px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#ffffff',
                                        fontWeight: 700,
                                        fontSize: '16px',
                                        flexShrink: 0,
                                        boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                                    }}>
                                        {(selectedEmail.fromName || selectedEmail.from)[0].toUpperCase()}
                                    </div>
                                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                                            {selectedEmail.fromName || selectedEmail.from} 
                                            <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '13px', marginLeft: '6px' }}>
                                                &lt;{selectedEmail.from}&gt;
                                            </span>
                                        </p>
                                        <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-dim)' }}>
                                            To: <span style={{ color: 'var(--text-secondary)' }}>{selectedEmail.to}</span> • {new Date(selectedEmail.createdAt).toLocaleString()}
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
                                            color: '#10b981',
                                            flexShrink: 0
                                        }}>
                                            <CheckCircle2 size={14} />
                                            <span>Lead: <b>{selectedEmail.leadId.name}</b></span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* OTP / Verification Code Banner (Google, etc.) */}
                            {selectedEmail.verificationCode && (
                                <div className="mail-otp-banner">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={{ 
                                            width: '42px', 
                                            height: '42px', 
                                            borderRadius: '50%', 
                                            background: 'rgba(99, 102, 241, 0.2)', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            color: 'var(--accent-color)',
                                            flexShrink: 0
                                        }}>
                                            <Key size={22} />
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800, color: 'var(--accent-color)' }}>
                                                Security Verification Code Detected
                                            </span>
                                            <div className="mail-otp-text">
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
                            <div className="mail-content-area">
                                {selectedEmail.html ? (
                                    <div 
                                        className="mail-html-card"
                                        dangerouslySetInnerHTML={{ __html: selectedEmail.html }} 
                                    />
                                ) : (
                                    <div className="mail-plain-text">
                                        {selectedEmail.text || '(Empty email content)'}
                                    </div>
                                )}
                            </div>

                            {/* Quick Reply Box */}
                            <div className="mail-reply-wrapper">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    <span>Reply to <strong style={{ color: 'var(--text-primary)' }}>{selectedEmail.from}</strong></span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Press Ctrl+Enter to send</span>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                    <textarea
                                        rows="2"
                                        className="mail-reply-input"
                                        placeholder={`Reply to ${selectedEmail.from}...`}
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSendReply();
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={handleSendReply}
                                        disabled={sendingReply || !replyText.trim()}
                                        className="btn-primary"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '13px', height: '42px', flexShrink: 0 }}
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
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', padding: '40px' }}>
                            <Mail size={52} style={{ opacity: 0.2, marginBottom: '16px' }} />
                            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>No Email Selected</h3>
                            <p style={{ fontSize: '13px', maxWidth: '320px', textAlign: 'center', margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                Select an email from the left to read messages, verify codes, or reply directly.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>

            {/* Compose Email Modal - Portaled to document.body */}
            {composeOpen && createPortal(
                <div className="modal-overlay" onClick={() => setComposeOpen(false)}>
                    <div 
                        className="modal-card animate-scale-up" 
                        style={{ maxWidth: '640px', padding: 0, display: 'flex', flexDirection: 'column' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Pinned Header */}
                        <div className="modal-header-fixed">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '10px',
                                        background: 'rgba(124, 58, 237, 0.12)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--accent-color)'
                                    }}>
                                        <Send size={18} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>Compose Direct Email</h3>
                                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Send an outreach email directly from your domain</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setComposeOpen(false)} 
                                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '6px' }}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Form Body */}
                        <div className="modal-body-scroll">
                            {myMailboxAddress && (
                                <div style={{ 
                                    fontSize: '12.5px', 
                                    color: 'var(--text-secondary)', 
                                    background: 'var(--bg-secondary)', 
                                    padding: '8px 14px', 
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <span>Sending from:</span>
                                    <strong style={{ color: 'var(--accent-color)', fontFamily: 'monospace' }}>{myMailboxAddress}</strong>
                                </div>
                            )}

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Recipient Email *
                                </label>
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
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Subject *
                                </label>
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
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Message Body *
                                </label>
                                <textarea
                                    rows="7"
                                    required
                                    placeholder="Write your email here..."
                                    value={composeBody}
                                    onChange={(e) => setComposeBody(e.target.value)}
                                    className="form-input"
                                    style={{ resize: 'vertical', lineHeight: 1.6 }}
                                />
                            </div>
                        </div>

                        {/* Pinned Footer */}
                        <div className="modal-footer-fixed">
                            <button 
                                type="button"
                                onClick={() => setComposeOpen(false)} 
                                className="btn-secondary" 
                                style={{ padding: '9px 18px', fontSize: '13px' }}
                            >
                                Cancel
                            </button>
                            <button 
                                type="button"
                                onClick={handleSendCompose} 
                                disabled={sendingEmail} 
                                className="btn-primary" 
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 22px', fontSize: '13px' }}
                            >
                                {sendingEmail ? <RefreshCw size={15} className="spin" /> : <Send size={15} />}
                                <span>{sendingEmail ? 'Dispatching...' : 'Send Email'}</span>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default EmailInbox;
