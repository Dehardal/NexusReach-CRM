import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Plus, CheckCircle2, AlertCircle, RefreshCw, Trash2, Power, ShieldCheck, Zap, Server, FileSpreadsheet, Download, UploadCloud, FileText, X, Key, Cpu, Check, Users, UserCheck, Inbox, CheckSquare, Square, Filter } from 'lucide-react';

const MailboxManager = () => {
    const { api, user } = useAuth();
    const [mailboxes, setMailboxes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [testingId, setTestingId] = useState(null);

    // Hostinger Agentic Mail API Integration State
    const [apiStatus, setApiStatus] = useState({ configured: false, maskedKey: '', domain: 'risegrowthgroup.com' });
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [showKeyConfig, setShowKeyConfig] = useState(false);
    const [savingApiKey, setSavingApiKey] = useState(false);
    const [syncingApi, setSyncingApi] = useState(false);
    const [importingPremade, setImportingPremade] = useState(false);
    const [apiBannerMsg, setApiBannerMsg] = useState(null);

    // Multi-User Assignment & Role-Based Access State
    const [usersList, setUsersList] = useState([]);
    const [selectedMailboxIds, setSelectedMailboxIds] = useState([]);
    const [targetAssignUser, setTargetAssignUser] = useState('');
    const [assigning, setAssigning] = useState(false);
    const [syncingInbox, setSyncingInbox] = useState(false);
    const [assignedFilter, setAssignedFilter] = useState('all');

    const isMaster = user?.role === 'master';
    const isMasterOrAdmin = ['master', 'admin'].includes(user?.role);

    // Bulk Import Modal States
    const [bulkModalOpen, setBulkModalOpen] = useState(false);
    const [bulkTab, setBulkTab] = useState('excel'); // 'excel' or 'text'
    const [excelFile, setExcelFile] = useState(null);
    const [textData, setTextData] = useState('');
    const [bulkSubmitting, setBulkSubmitting] = useState(false);
    const [bulkResult, setBulkResult] = useState(null);

    // Form inputs (Single)
    const [senderName, setSenderName] = useState('');
    const [emailUser, setEmailUser] = useState('');
    const [emailPass, setEmailPass] = useState('');
    const [provider, setProvider] = useState('hostinger');
    const [smtpHost, setSmtpHost] = useState('smtp.hostinger.com');
    const [smtpPort, setSmtpPort] = useState(465);
    const [dailyLimit, setDailyLimit] = useState(100);
    const [submitting, setSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState(null);

    const fetchMailboxes = async () => {
        try {
            const { data } = await api.get('/mailboxes');
            setMailboxes(data);
        } catch (err) {
            console.error('[MAILBOX MANAGER] Error fetching mailboxes:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsersList = async () => {
        if (!isMasterOrAdmin) return;
        try {
            const { data } = await api.get('/auth/users-list');
            setUsersList(Array.isArray(data) ? data : []);
        } catch (err) {
            console.warn('[USERS LIST FETCH WARNING]', err.message);
        }
    };

    const fetchApiStatus = async () => {
        try {
            const { data } = await api.get('/mailboxes/hostinger-api-status');
            setApiStatus(data);
        } catch (err) {
            console.error('[HOSTINGER API STATUS ERROR]', err);
        }
    };

    useEffect(() => {
        fetchMailboxes();
        fetchApiStatus();
        fetchUsersList();
    }, []);

    const handleAssignMailboxes = async (overrideTargetUser = null, specificIds = null) => {
        const targetId = overrideTargetUser !== null ? overrideTargetUser : targetAssignUser;
        const idsToAssign = specificIds || selectedMailboxIds;

        if (idsToAssign.length === 0) {
            alert('Please select at least one mailbox to assign.');
            return;
        }

        setAssigning(true);
        setApiBannerMsg(null);
        try {
            const { data } = await api.post('/mailboxes/assign', {
                mailboxIds: idsToAssign,
                targetUserId: targetId
            });
            setApiBannerMsg({ type: 'success', text: data.message });
            setSelectedMailboxIds([]);
            await fetchMailboxes();
        } catch (err) {
            setApiBannerMsg({ type: 'error', text: err.response?.data?.message || 'Assignment failed' });
        } finally {
            setAssigning(false);
        }
    };

    const handleSyncInbox = async () => {
        setSyncingInbox(true);
        setApiBannerMsg(null);
        try {
            const { data } = await api.post('/mailboxes/sync-inbox');
            setApiBannerMsg({ type: 'success', text: `✓ ${data.message}` });
        } catch (err) {
            setApiBannerMsg({ type: 'error', text: err.response?.data?.message || 'Failed to sync incoming inbox' });
        } finally {
            setSyncingInbox(false);
        }
    };

    const toggleSelectMailbox = (id) => {
        setSelectedMailboxIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        const currentFiltered = filteredMailboxes;
        if (selectedMailboxIds.length === currentFiltered.length && currentFiltered.length > 0) {
            setSelectedMailboxIds([]);
        } else {
            setSelectedMailboxIds(currentFiltered.map(m => m._id));
        }
    };

    const handleSaveApiKey = async (e) => {
        if (e) e.preventDefault();
        if (!apiKeyInput.trim()) return;
        setSavingApiKey(true);
        setApiBannerMsg(null);
        try {
            const { data } = await api.post('/mailboxes/save-api-key', { apiKey: apiKeyInput.trim() });
            setApiBannerMsg({ type: 'success', text: data.message });
            setApiKeyInput('');
            setShowKeyConfig(false);
            fetchApiStatus();
        } catch (err) {
            setApiBannerMsg({ type: 'error', text: err.response?.data?.message || 'Failed to verify API key' });
        } finally {
            setSavingApiKey(false);
        }
    };

    const handleSyncHostingerApi = async () => {
        setSyncingApi(true);
        setApiBannerMsg(null);
        try {
            const { data } = await api.post('/mailboxes/sync-hostinger-api', { defaultLimit: 500 });
            setApiBannerMsg({ type: 'success', text: data.message });
            await fetchMailboxes();
            fetchApiStatus();
        } catch (err) {
            setApiBannerMsg({ type: 'error', text: err.response?.data?.message || 'Hostinger API sync failed' });
        } finally {
            setSyncingApi(false);
        }
    };

    const handleImport199Premade = async () => {
        setImportingPremade(true);
        setApiBannerMsg(null);
        try {
            const { data } = await api.post('/mailboxes/import-199-premade', { count: 199 });
            setApiBannerMsg({ type: 'success', text: data.message });
            await fetchMailboxes();
        } catch (err) {
            setApiBannerMsg({ type: 'error', text: err.response?.data?.message || 'Activation failed' });
        } finally {
            setImportingPremade(false);
        }
    };

    const handleProviderChange = (newProvider) => {
        setProvider(newProvider);
        if (newProvider === 'hostinger') {
            setSmtpHost('smtp.hostinger.com');
            setSmtpPort(465);
        } else if (newProvider === 'gmail') {
            setSmtpHost('smtp.gmail.com');
            setSmtpPort(587);
        } else if (newProvider === 'brevo') {
            setSmtpHost('smtp-relay.brevo.com');
            setSmtpPort(587);
        } else if (newProvider === 'outlook') {
            setSmtpHost('smtp.office365.com');
            setSmtpPort(587);
        }
    };

    const openCreateModal = () => {
        setSenderName('');
        setEmailUser('');
        setEmailPass('');
        setProvider('hostinger');
        setSmtpHost('smtp.hostinger.com');
        setSmtpPort(465);
        setDailyLimit(100);
        setStatusMessage(null);
        setModalOpen(true);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setStatusMessage(null);

        try {
            const { data } = await api.post('/mailboxes', {
                senderName,
                emailUser,
                emailPass,
                provider,
                smtpHost,
                smtpPort,
                dailyLimit
            });

            setStatusMessage({ type: 'success', text: data.message });
            setTimeout(() => {
                setModalOpen(false);
                fetchMailboxes();
            }, 1200);
        } catch (err) {
            setStatusMessage({ 
                type: 'error', 
                text: err.response?.data?.message || 'Failed to connect mailbox. Check your Hostinger password.' 
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleTest = async (id, email) => {
        setTestingId(id);
        try {
            const { data } = await api.post(`/mailboxes/${id}/test`);
            alert(data.message || `✓ Success: ${email} is connected and ready to send!`);
            fetchMailboxes();
        } catch (err) {
            alert(`⚠️ Connection check failed: ${err.response?.data?.message || err.message}`);
            fetchMailboxes();
        } finally {
            setTestingId(null);
        }
    };

    const handleToggleStatus = async (mb) => {
        const newStatus = mb.status === 'active' ? 'paused' : 'active';
        try {
            await api.put(`/mailboxes/${mb._id}`, { status: newStatus });
            fetchMailboxes();
        } catch (err) {
            alert(err.response?.data?.message || 'Error updating status');
        }
    };

    const handleDelete = async (id, email) => {
        if (window.confirm(`Disconnect and remove ${email}?`)) {
            try {
                await api.delete(`/mailboxes/${id}`);
                fetchMailboxes();
            } catch (err) {
                alert(err.response?.data?.message || 'Error deleting mailbox');
            }
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const response = await api.get('/mailboxes/template/excel', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'Hostinger_Mailboxes_Template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert('Failed to download template: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleBulkImport = async (e) => {
        e.preventDefault();
        setBulkSubmitting(true);
        setBulkResult(null);

        try {
            let res;
            if (bulkTab === 'excel') {
                if (!excelFile) {
                    alert('Please select an Excel or CSV file first');
                    setBulkSubmitting(false);
                    return;
                }
                const formData = new FormData();
                formData.append('file', excelFile);
                res = await api.post('/mailboxes/bulk-import', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                if (!textData.trim()) {
                    alert('Please enter or paste mailbox credentials');
                    setBulkSubmitting(false);
                    return;
                }
                res = await api.post('/mailboxes/bulk-import', { textData });
            }

            setBulkResult({ type: 'success', message: res.data.message, stats: res.data.stats });
            fetchMailboxes();
        } catch (err) {
            setBulkResult({
                type: 'error',
                message: err.response?.data?.message || 'Bulk import failed. Please check format.'
            });
        } finally {
            setBulkSubmitting(false);
        }
    };

    const filteredMailboxes = mailboxes.filter(m => {
        if (assignedFilter === 'all') return true;
        if (assignedFilter === 'unassigned') return !m.assignedTo;
        return (m.assignedTo?._id || m.assignedTo) === assignedFilter;
    });

    const activeCount = filteredMailboxes.filter(m => m.status === 'active').length;
    const totalDailyCapacity = filteredMailboxes.filter(m => m.status === 'active').reduce((acc, m) => acc + (m.dailyLimit || 100), 0);
    const sentTodayCount = filteredMailboxes.reduce((acc, m) => acc + (m.sentToday || 0), 0);

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '6px' }}>Hostinger Connected Mailboxes</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Manage your pool of email accounts. The CRM rotates outreach across these Hostinger inboxes to maintain 100% domain reputation.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button 
                        onClick={() => { setBulkModalOpen(true); setBulkResult(null); }} 
                        className="btn-secondary" 
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <FileSpreadsheet size={18} />
                        <span>Bulk Import (Excel / Text)</span>
                    </button>
                    <button onClick={openCreateModal} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={18} />
                        <span>Connect Single Mailbox</span>
                    </button>
                </div>
            </header>

            {/* Hostinger Agentic Mail API Integration Hub */}
            <div 
                className="glass-panel" 
                style={{ 
                    marginBottom: '28px', 
                    padding: '24px', 
                    background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.5) 0%, rgba(15, 23, 42, 0.75) 100%)',
                    border: '1px solid rgba(139, 92, 246, 0.35)',
                    boxShadow: '0 8px 32px -8px rgba(124, 58, 237, 0.18)',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {/* Glow accent */}
                <div style={{
                    position: 'absolute',
                    top: '-60px',
                    right: '-60px',
                    width: '200px',
                    height: '200px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(139, 92, 246, 0.25) 0%, transparent 70%)',
                    pointerEvents: 'none'
                }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            boxShadow: '0 4px 14px rgba(124, 58, 237, 0.4)'
                        }}>
                            <Cpu size={24} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Hostinger Agentic Mail API Hub</h2>
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '3px 10px',
                                    borderRadius: '20px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    background: apiStatus.configured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                    color: apiStatus.configured ? '#10b981' : '#f59e0b',
                                    border: `1px solid ${apiStatus.configured ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                                }}>
                                    {apiStatus.configured ? <Check size={12} /> : <AlertCircle size={12} />}
                                    {apiStatus.configured ? `Token Active (${apiStatus.maskedKey})` : 'Token Not Configured'}
                                </span>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
                                Domain: <code style={{ color: '#a78bfa', fontWeight: 600 }}>@{apiStatus.domain || 'risegrowthgroup.com'}</code> • Scope: <strong>All Mailboxes</strong> • Direct API & SMTP Multi-Engine
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setShowKeyConfig(!showKeyConfig)}
                            className="btn-secondary"
                            style={{ fontSize: '13px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Key size={14} />
                            <span>{showKeyConfig ? 'Hide Token Config' : 'Update API Token'}</span>
                        </button>
                        <button
                            onClick={handleSyncHostingerApi}
                            disabled={syncingApi}
                            style={{
                                background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
                                color: '#ffffff',
                                border: 'none',
                                padding: '8px 18px',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '13px',
                                cursor: syncingApi ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
                            }}
                        >
                            <RefreshCw size={15} className={syncingApi ? 'spin' : ''} />
                            <span>{syncingApi ? 'Syncing Mailboxes...' : '🔄 Sync Mailboxes via API'}</span>
                        </button>
                        <button
                            onClick={handleImport199Premade}
                            disabled={importingPremade}
                            style={{
                                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                                color: '#ffffff',
                                border: 'none',
                                padding: '8px 18px',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '13px',
                                cursor: importingPremade ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                            }}
                        >
                            <Zap size={15} className={importingPremade ? 'spin' : ''} />
                            <span>{importingPremade ? 'Activating...' : '⚡ Activate All 199 Mailboxes'}</span>
                        </button>
                        <button
                            onClick={handleSyncInbox}
                            disabled={syncingInbox}
                            style={{
                                background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
                                color: '#ffffff',
                                border: 'none',
                                padding: '8px 18px',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '13px',
                                cursor: syncingInbox ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)'
                            }}
                        >
                            <Inbox size={15} className={syncingInbox ? 'spin' : ''} />
                            <span>{syncingInbox ? 'Checking Inboxes...' : '📥 Sync Received Replies'}</span>
                        </button>
                    </div>
                </div>

                {/* Banner Message */}
                {apiBannerMsg && (
                    <div style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        background: apiBannerMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        border: `1px solid ${apiBannerMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        color: apiBannerMsg.type === 'success' ? '#10b981' : '#ef4444',
                        fontSize: '13px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {apiBannerMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                            <span>{apiBannerMsg.text}</span>
                        </div>
                        <button onClick={() => setApiBannerMsg(null)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px' }}>
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Token Configuration Drawer / Form */}
                {showKeyConfig && (
                    <form onSubmit={handleSaveApiKey} style={{
                        background: 'rgba(0, 0, 0, 0.25)',
                        padding: '16px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                    }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '280px' }}>
                                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    Hostinger Agentic Mail API Token (from hPanel → Emails → Agentic Mail → API Access):
                                </label>
                                <input
                                    type="password"
                                    placeholder={apiStatus.maskedKey || "Paste your Hostinger API Token here"}
                                    value={apiKeyInput}
                                    onChange={(e) => setApiKeyInput(e.target.value)}
                                    className="input-field"
                                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px' }}
                                />
                            </div>
                            <div style={{ alignSelf: 'flex-end' }}>
                                <button
                                    type="submit"
                                    disabled={savingApiKey || !apiKeyInput.trim()}
                                    className="btn-primary"
                                    style={{ padding: '9px 20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Key size={14} />
                                    <span>{savingApiKey ? 'Verifying...' : 'Save & Verify Token'}</span>
                                </button>
                            </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim)' }}>
                            🔒 Tokens are stored securely on your server and used to dispatch outreach via Hostinger Agentic Mail API endpoints (<code style={{ color: '#a78bfa' }}>https://api.mail.hostinger.com</code>).
                        </p>
                    </form>
                )}
            </div>

            {/* Metric Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06b6d4' }}>
                        <Mail size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>Active Mailboxes</p>
                        <h2 style={{ fontSize: '26px', fontWeight: 700, margin: '2px 0 0 0' }}>{activeCount} / {mailboxes.length}</h2>
                    </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                        <Zap size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>Daily Outreach Capacity</p>
                        <h2 style={{ fontSize: '26px', fontWeight: 700, margin: '2px 0 0 0' }}>{totalDailyCapacity.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-dim)' }}>emails/day</span></h2>
                    </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                        <Server size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>Dispatched Today</p>
                        <h2 style={{ fontSize: '26px', fontWeight: 700, margin: '2px 0 0 0' }}>{sentTodayCount.toLocaleString()}</h2>
                    </div>
                </div>
            </div>

            {/* Multi-User Mailbox Assignment & Filter Toolbar (Master & Admins) */}
            {isMasterOrAdmin && (
                <div className="glass-panel" style={{
                    padding: '16px 20px',
                    marginBottom: '24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(15, 23, 42, 0.65)'
                }}>
                    {/* Left: Filter Tabs & Dropdown */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px', marginRight: '6px' }}>
                            <Filter size={15} />
                            <span>Filter Inboxes:</span>
                        </div>
                        <button
                            onClick={() => setAssignedFilter('all')}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                fontSize: '12.5px',
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer',
                                background: assignedFilter === 'all' ? 'var(--accent-color, #7c3aed)' : 'rgba(255,255,255,0.06)',
                                color: '#fff'
                            }}
                        >
                            All ({mailboxes.length})
                        </button>
                        <button
                            onClick={() => setAssignedFilter('unassigned')}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                fontSize: '12.5px',
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer',
                                background: assignedFilter === 'unassigned' ? 'var(--accent-color, #7c3aed)' : 'rgba(255,255,255,0.06)',
                                color: '#fff'
                            }}
                        >
                            Unassigned ({mailboxes.filter(m => !m.assignedTo).length})
                        </button>

                        {usersList.length > 0 && (
                            <select
                                value={['all', 'unassigned'].includes(assignedFilter) ? '' : assignedFilter}
                                onChange={e => setAssignedFilter(e.target.value || 'all')}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '12.5px',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    color: '#fff',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="" style={{ background: '#1e1b4b', color: '#fff' }}>Filter by Assigned User...</option>
                                {usersList.map(u => (
                                    <option key={u._id} value={u._id} style={{ background: '#1e1b4b', color: '#fff' }}>
                                        {u.name} ({u.role}) - {mailboxes.filter(m => (m.assignedTo?._id || m.assignedTo) === u._id).length} inboxes
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Right: Bulk Assignment Action Toolbar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                            onClick={toggleSelectAll}
                            className="btn-secondary"
                            style={{ padding: '6px 14px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            {selectedMailboxIds.length === filteredMailboxes.length && filteredMailboxes.length > 0 ? (
                                <>
                                    <CheckSquare size={15} style={{ color: '#10b981' }} />
                                    <span>Deselect All</span>
                                </>
                            ) : (
                                <>
                                    <Square size={15} />
                                    <span>Select All ({filteredMailboxes.length})</span>
                                </>
                            )}
                        </button>

                        {selectedMailboxIds.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(124, 58, 237, 0.2)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(124, 58, 237, 0.4)' }}>
                                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#c4b5fd' }}>
                                    {selectedMailboxIds.length} selected
                                </span>
                                <select
                                    value={targetAssignUser}
                                    onChange={e => setTargetAssignUser(e.target.value)}
                                    style={{
                                        padding: '5px 10px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        background: '#1e1b4b',
                                        color: '#fff',
                                        border: '1px solid rgba(167, 139, 250, 0.4)'
                                    }}
                                >
                                    <option value="">Select Assignee (Admin / Mail Pedia)...</option>
                                    {usersList.map(u => (
                                        <option key={u._id} value={u._id}>
                                            {u.name} ({u.role} - {u.email})
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => handleAssignMailboxes(null)}
                                    disabled={assigning || !targetAssignUser}
                                    style={{
                                        background: '#7c3aed',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '6px 14px',
                                        borderRadius: '6px',
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        cursor: assigning || !targetAssignUser ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {assigning ? 'Assigning...' : 'Assign'}
                                </button>
                                <button
                                    onClick={() => handleAssignMailboxes('unassign')}
                                    disabled={assigning}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.2)',
                                        color: '#ef4444',
                                        border: '1px solid rgba(239, 68, 68, 0.4)',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        fontWeight: 600,
                                        fontSize: '12px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Unassign
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Mailboxes Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>Loading connected mailboxes...</div>
            ) : filteredMailboxes.length === 0 ? (
                <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <Mail size={48} style={{ color: 'var(--text-dim)', marginBottom: '16px' }} />
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No Mailboxes Match Current Filter</h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 auto 24px auto', fontSize: '14px' }}>
                        {assignedFilter !== 'all' ? 'No mailboxes found under the selected user filter. Switch to "All" to view your full pool.' : 'Connect your Hostinger domain emails to launch high-deliverability cold email campaigns.'}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <button onClick={() => setAssignedFilter('all')} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <span>View All Mailboxes</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
                    {filteredMailboxes.map((mb) => {
                        const isTesting = testingId === mb._id;
                        const usagePercent = mb.dailyLimit ? Math.min(100, Math.round(((mb.sentToday || 0) / mb.dailyLimit) * 100)) : 0;
                        const isSelected = selectedMailboxIds.includes(mb._id);

                        return (
                            <div 
                                key={mb._id} 
                                className="glass-panel" 
                                style={{ 
                                    padding: '24px', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '16px',
                                    border: isSelected ? '1px solid #a78bfa' : '1px solid rgba(255, 255, 255, 0.08)',
                                    background: isSelected ? 'rgba(124, 58, 237, 0.08)' : undefined,
                                    position: 'relative'
                                }}
                            >
                                {/* Top Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                        {isMasterOrAdmin && (
                                            <input 
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelectMailbox(mb._id)}
                                                style={{ marginTop: '4px', cursor: 'pointer', transform: 'scale(1.15)' }}
                                            />
                                        )}
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, wordBreak: 'break-all' }}>{mb.emailUser}</h3>
                                                <span style={{
                                                    fontSize: '10px',
                                                    textTransform: 'uppercase',
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    fontWeight: 700,
                                                    background: mb.provider === 'hostinger' ? 'rgba(103, 58, 183, 0.2)' : 'rgba(255,255,255,0.1)',
                                                    color: mb.provider === 'hostinger' ? '#a78bfa' : 'var(--text-secondary)'
                                                }}>
                                                    {mb.provider}
                                                </span>
                                                {(mb.isApiManaged || mb.mailboxResourceId) && (
                                                    <span style={{
                                                        fontSize: '10px',
                                                        padding: '2px 8px',
                                                        borderRadius: '6px',
                                                        fontWeight: 700,
                                                        background: 'rgba(16, 185, 129, 0.2)',
                                                        color: '#10b981',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '3px'
                                                    }}>
                                                        <Zap size={10} /> Agentic API
                                                    </span>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                                                    Sender: <strong>{mb.senderName}</strong>
                                                </p>
                                                {/* Assignment Badge */}
                                                {mb.assignedTo ? (
                                                    <span style={{
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        padding: '2px 8px',
                                                        borderRadius: '6px',
                                                        background: 'rgba(59, 130, 246, 0.2)',
                                                        color: '#60a5fa',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        <UserCheck size={12} /> Assigned: {mb.assignedTo.name} ({mb.assignedTo.role})
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        fontSize: '11px',
                                                        fontWeight: 600,
                                                        padding: '2px 8px',
                                                        borderRadius: '6px',
                                                        background: 'rgba(255, 255, 255, 0.06)',
                                                        color: 'var(--text-dim)',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        <Users size={12} /> Unassigned (Master Pool)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        padding: '4px 10px',
                                        borderRadius: '20px',
                                        background: mb.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : mb.status === 'paused' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                        color: mb.status === 'active' ? '#10b981' : mb.status === 'paused' ? '#f59e0b' : '#ef4444'
                                    }}>
                                        {mb.status === 'active' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                                        <span style={{ textTransform: 'capitalize' }}>{mb.status}</span>
                                    </span>
                                </div>

                                {/* Server details */}
                                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span>SMTP Server:</span>
                                        <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{mb.smtpHost}:{mb.smtpPort}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>IMAP (Replies):</span>
                                        <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{mb.imapHost}:{mb.imapPort}</span>
                                    </div>
                                </div>

                                {/* Daily Quota Progress */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Daily Warmup Limit:</span>
                                        <span style={{ fontWeight: 600 }}>{mb.sentToday || 0} / {mb.dailyLimit} sent</span>
                                    </div>
                                    <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${usagePercent}%`,
                                            height: '100%',
                                            background: usagePercent > 85 ? '#ef4444' : 'var(--accent-color)',
                                            transition: 'width 0.3s ease'
                                        }} />
                                    </div>
                                </div>

                                {/* Error warning if any */}
                                {mb.lastError && (
                                    <p style={{ margin: 0, fontSize: '11.5px', color: '#f87171', background: 'rgba(239,68,68,0.08)', padding: '8px', borderRadius: '6px' }}>
                                        ⚠️ {mb.lastError}
                                    </p>
                                )}

                                {/* Bottom action buttons */}
                                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                    <button 
                                        onClick={() => handleTest(mb._id, mb.emailUser)} 
                                        disabled={isTesting}
                                        className="btn-secondary" 
                                        style={{ flexGrow: 1, padding: '8px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                    >
                                        <RefreshCw size={13} className={isTesting ? 'animate-spin' : ''} />
                                        <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                                    </button>

                                    <button 
                                        onClick={() => handleToggleStatus(mb)} 
                                        className="btn-secondary" 
                                        style={{ padding: '8px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        title={mb.status === 'active' ? 'Pause Mailbox' : 'Activate Mailbox'}
                                    >
                                        <Power size={14} style={{ color: mb.status === 'active' ? '#f59e0b' : '#10b981' }} />
                                    </button>

                                    <button 
                                        onClick={() => handleDelete(mb._id, mb.emailUser)} 
                                        className="btn-secondary" 
                                        style={{ padding: '8px 12px', fontSize: '12.5px', color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}
                                        title="Delete Mailbox"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal: Connect Single Mailbox */}
            {modalOpen && (
                <div className="modal-overlay" onClick={() => !submitting && setModalOpen(false)}>
                    <div className="glass-panel modal-card animate-modal-in" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
                                    Connect {provider === 'hostinger' ? 'Hostinger' : provider === 'gmail' ? 'Google Workspace / Gmail' : provider === 'outlook' ? 'Outlook 365' : provider === 'brevo' ? 'Brevo' : 'Custom'} Mailbox
                                </h2>
                                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                                    Add your sender email credentials to the outreach rotation pool
                                </p>
                            </div>
                            <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                ✕
                            </button>
                        </div>

                        {statusMessage && (
                            <div style={{
                                padding: '12px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                marginBottom: '16px',
                                background: statusMessage.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                border: `1px solid ${statusMessage.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                                color: statusMessage.type === 'success' ? '#10b981' : '#f87171'
                            }}>
                                {statusMessage.text}
                            </div>
                        )}

                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Provider</label>
                                <select value={provider} onChange={e => handleProviderChange(e.target.value)} className="form-input">
                                    <option value="hostinger">Hostinger Business Webmail</option>
                                    <option value="gmail">Google Workspace / Gmail (App Password)</option>
                                    <option value="outlook">Microsoft Outlook / Office 365</option>
                                    <option value="brevo">Brevo SMTP Relay</option>
                                    <option value="custom">Custom SMTP / cPanel / Zoho</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Sender Display Name</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={senderName} 
                                    onChange={e => setSenderName(e.target.value)} 
                                    className="form-input" 
                                    placeholder="e.g. Rachel from Admissions" 
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                                    {provider === 'hostinger' ? 'Hostinger Email Address' : provider === 'gmail' ? 'Gmail / Workspace Address' : 'Email Address'}
                                </label>
                                <input 
                                    type="email" 
                                    required 
                                    value={emailUser} 
                                    onChange={e => setEmailUser(e.target.value)} 
                                    className="form-input" 
                                    placeholder={provider === 'gmail' ? 'yourname@gmail.com' : 'outreach@yourdomain.com'} 
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                                    {provider === 'gmail' ? 'Google App Password (16 characters)' : 'Email / SMTP Password'}
                                </label>
                                <input 
                                    type="password" 
                                    required 
                                    value={emailPass} 
                                    onChange={e => setEmailPass(e.target.value)} 
                                    className="form-input" 
                                    placeholder={provider === 'gmail' ? 'abcd efgh ijkl mnop' : 'Your email password'} 
                                />
                                {provider === 'gmail' && (
                                    <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: '#a78bfa' }}>
                                        💡 For Gmail/Workspace: Generate a 16-character App Password under your Google Account → Security → 2-Step Verification → App Passwords.
                                    </p>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>SMTP Host</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={smtpHost} 
                                        onChange={e => setSmtpHost(e.target.value)} 
                                        className="form-input" 
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Port</label>
                                    <input 
                                        type="number" 
                                        required 
                                        value={smtpPort} 
                                        onChange={e => setSmtpPort(e.target.value)} 
                                        className="form-input" 
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                                    Daily Sending Limit (Warmup Safety)
                                </label>
                                <input 
                                    type="number" 
                                    min="10" 
                                    max="500" 
                                    value={dailyLimit} 
                                    onChange={e => setDailyLimit(e.target.value)} 
                                    className="form-input" 
                                />
                                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                    Recommended: 50–100 emails/day per Hostinger inbox.
                                </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary" disabled={submitting}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {submitting ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={16} />}
                                    <span>{submitting ? 'Verifying with Hostinger...' : 'Verify & Connect Mailbox'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Bulk Import Mailboxes (Excel / Text) */}
            {bulkModalOpen && (
                <div className="modal-overlay" onClick={() => !bulkSubmitting && setBulkModalOpen(false)}>
                    <div className="glass-panel modal-card animate-modal-in" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)' }}>
                                    <FileSpreadsheet size={20} />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>Bulk Import Hostinger Mailboxes</h2>
                                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                                        Connect 5, 10, or 20+ mailboxes instantly with passwords
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => !bulkSubmitting && setBulkModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Tab Switcher */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(255, 255, 255, 0.04)', padding: '4px', borderRadius: '8px' }}>
                            <button
                                type="button"
                                onClick={() => setBulkTab('excel')}
                                style={{
                                    flex: 1,
                                    padding: '8px 14px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    background: bulkTab === 'excel' ? 'var(--accent-color)' : 'transparent',
                                    color: bulkTab === 'excel' ? '#fff' : 'var(--text-secondary)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <FileSpreadsheet size={15} />
                                <span>Excel / CSV File</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setBulkTab('text')}
                                style={{
                                    flex: 1,
                                    padding: '8px 14px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    background: bulkTab === 'text' ? 'var(--accent-color)' : 'transparent',
                                    color: bulkTab === 'text' ? '#fff' : 'var(--text-secondary)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <FileText size={15} />
                                <span>Quick Text Paste</span>
                            </button>
                        </div>

                        <form onSubmit={handleBulkImport}>
                            {bulkTab === 'excel' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {/* Template Download Banner */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: 'rgba(139, 92, 246, 0.08)',
                                        border: '1px solid rgba(139, 92, 246, 0.25)',
                                        padding: '12px 16px',
                                        borderRadius: '10px'
                                    }}>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Need the Excel format?</p>
                                            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>Columns: email, password, senderName, dailyLimit</p>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={handleDownloadTemplate} 
                                            className="btn-secondary" 
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
                                        >
                                            <Download size={14} />
                                            <span>Download .xlsx</span>
                                        </button>
                                    </div>

                                    {/* File Dropzone */}
                                    <div 
                                        style={{
                                            border: '2px dashed rgba(255, 255, 255, 0.18)',
                                            borderRadius: '12px',
                                            padding: '28px 20px',
                                            textAlign: 'center',
                                            background: excelFile ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onClick={() => document.getElementById('mailbox-file-input').click()}
                                    >
                                        <UploadCloud size={36} style={{ color: excelFile ? '#10b981' : 'var(--accent-color)', marginBottom: '8px' }} />
                                        <p style={{ fontWeight: 600, margin: '0 0 4px 0', fontSize: '14px', color: excelFile ? '#10b981' : 'var(--text-primary)' }}>
                                            {excelFile ? `Selected: ${excelFile.name}` : 'Click to select or drop Excel / CSV file'}
                                        </p>
                                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                                            {excelFile ? `${(excelFile.size / 1024).toFixed(1)} KB` : 'Supports .xlsx, .xls, or .csv'}
                                        </p>
                                        <input 
                                            id="mailbox-file-input" 
                                            type="file" 
                                            accept=".xlsx, .xls, .csv" 
                                            style={{ display: 'none' }} 
                                            onChange={e => setExcelFile(e.target.files[0])} 
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        Paste one mailbox per line (format: <code>email:password</code> or <code>email,password,senderName,dailyLimit</code>):
                                    </label>
                                    <textarea
                                        rows="7"
                                        className="form-input"
                                        style={{ fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.6 }}
                                        placeholder={`outreach1@yourdomain.com:YourPass@123\noutreach2@yourdomain.com:YourPass@123,Desk 2,500\ncounselor@yourdomain.com:YourPass@123,Senior Counselor,400`}
                                        value={textData}
                                        onChange={e => setTextData(e.target.value)}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)' }}>
                                        <span>Supported delimiters: colon (:), comma (,), pipe (|), or tab</span>
                                        <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
                                            {textData.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#')).length} mailboxes detected
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Result feedback */}
                            {bulkResult && (
                                <div style={{
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    marginTop: '16px',
                                    background: bulkResult.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                    border: `1px solid ${bulkResult.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                                    color: bulkResult.type === 'success' ? '#10b981' : '#f87171'
                                }}>
                                    {bulkResult.message}
                                </div>
                            )}

                            {/* Footer Buttons */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setBulkModalOpen(false)} 
                                    className="btn-secondary" 
                                    disabled={bulkSubmitting}
                                >
                                    Close
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn-primary" 
                                    disabled={bulkSubmitting} 
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    {bulkSubmitting ? <RefreshCw size={15} className="animate-spin" /> : <ShieldCheck size={16} />}
                                    <span>{bulkSubmitting ? 'Importing & Encrypting...' : 'Import All Mailboxes'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MailboxManager;
