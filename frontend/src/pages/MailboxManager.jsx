import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, CheckCircle2, AlertCircle, RefreshCw, Trash2, Power, ShieldCheck, Zap, Server, X, Users, UserCheck, Inbox, CheckSquare, Square, PauseCircle, PlayCircle, Scale, Settings, Search, Globe, Sparkles } from 'lucide-react';
import CustomDropdown from '../components/CustomDropdown';

const MailboxManager = () => {
    const { api, user } = useAuth();
    const [mailboxes, setMailboxes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [testingId, setTestingId] = useState(null);
    const [apiBannerMsg, setApiBannerMsg] = useState(null);

    // Multi-User Assignment & Role-Based Access State
    const [usersList, setUsersList] = useState([]);
    const [selectedMailboxIds, setSelectedMailboxIds] = useState([]);
    const [targetAssignUser, setTargetAssignUser] = useState('');
    const [assigning, setAssigning] = useState(false);
    const [bulkUpdatingStatus, setBulkUpdatingStatus] = useState(false);
    const [syncingInbox, setSyncingInbox] = useState(false);
    const [assignedFilter, setAssignedFilter] = useState('all');
    const [providerFilter, setProviderFilter] = useState('all'); // 'all' | 'cloudflare' | 'hostinger' | 'custom'
    const [searchFilter, setSearchFilter] = useState('');

    // Multi-User Distribution Modal State
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [distributionMode, setDistributionMode] = useState('equal'); // 'equal' | 'manual' | 'single'
    const [selectedAssignUsers, setSelectedAssignUsers] = useState([]);
    const [manualCounts, setManualCounts] = useState({});

    const isMaster = user?.role === 'master';
    const isMasterOrAdmin = ['master', 'admin'].includes(user?.role);

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
            // Strictly fetch eligible mailbox assignees: Admin only sees mail_pedia, Master sees admin and mail_pedia
            const { data } = await api.get('/auth/users-list?forMailbox=true');
            setUsersList(Array.isArray(data) ? data : []);
        } catch (err) {
            console.warn('[USERS LIST FETCH WARNING]', err.message);
        }
    };

    useEffect(() => {
        fetchMailboxes();
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
            const payload = {
                mailboxIds: idsToAssign,
                assignedTo: targetId === 'unassign' ? null : targetId
            };
            const { data } = await api.post('/mailboxes/assign', payload);
            setApiBannerMsg({ type: 'success', text: data.message });
            setSelectedMailboxIds([]);
            await fetchMailboxes();
        } catch (err) {
            setApiBannerMsg({ type: 'error', text: err.response?.data?.message || 'Assignment failed' });
        } finally {
            setAssigning(false);
        }
    };

    const openAssignModal = () => {
        if (selectedMailboxIds.length === 0) {
            alert('Please select at least one mailbox first.');
            return;
        }
        const allUserIds = usersList.map(u => u._id);
        setSelectedAssignUsers(allUserIds);

        // Precalculate equal split into manual numbers (Hybrid composition)
        const initialCounts = {};
        const count = allUserIds.length;
        if (count > 0) {
            const base = Math.floor(selectedMailboxIds.length / count);
            let rem = selectedMailboxIds.length % count;
            allUserIds.forEach(uid => {
                initialCounts[uid] = base + (rem > 0 ? 1 : 0);
                if (rem > 0) rem--;
            });
        }
        setManualCounts(initialCounts);
        setDistributionMode('hybrid');
        setAssignModalOpen(true);
    };

    const rebalanceEqually = () => {
        const activeUsers = selectedAssignUsers;
        if (activeUsers.length === 0) return;
        const total = selectedMailboxIds.length;
        const base = Math.floor(total / activeUsers.length);
        let rem = total % activeUsers.length;
        const newCounts = { ...manualCounts };
        activeUsers.forEach(uid => {
            newCounts[uid] = base + (rem > 0 ? 1 : 0);
            if (rem > 0) rem--;
        });
        usersList.forEach(u => {
            if (!activeUsers.includes(u._id)) {
                newCounts[u._id] = 0;
            }
        });
        setManualCounts(newCounts);
    };

    const toggleAssignUser = (userId) => {
        setSelectedAssignUsers(prev => {
            const next = prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId];
            if (next.length > 0) {
                const total = selectedMailboxIds.length;
                const base = Math.floor(total / next.length);
                let rem = total % next.length;
                const updatedManual = { ...manualCounts };
                next.forEach(uid => {
                    updatedManual[uid] = base + (rem > 0 ? 1 : 0);
                    if (rem > 0) rem--;
                });
                usersList.forEach(u => {
                    if (!next.includes(u._id)) {
                        updatedManual[u._id] = 0;
                    }
                });
                setManualCounts(updatedManual);
            }
            return next;
        });
    };

    const toggleSelectAllAssignUsers = () => {
        if (selectedAssignUsers.length === usersList.length) {
            setSelectedAssignUsers([]);
            const zeroed = {};
            usersList.forEach(u => { zeroed[u._id] = 0; });
            setManualCounts(zeroed);
        } else {
            const allIds = usersList.map(u => u._id);
            setSelectedAssignUsers(allIds);
            const base = Math.floor(selectedMailboxIds.length / allIds.length);
            let rem = selectedMailboxIds.length % allIds.length;
            const updatedManual = {};
            allIds.forEach(uid => {
                updatedManual[uid] = base + (rem > 0 ? 1 : 0);
                if (rem > 0) rem--;
            });
            setManualCounts(updatedManual);
        }
    };

    const handleDistributedAssign = async () => {
        if (selectedMailboxIds.length === 0) {
            alert('Please select at least one mailbox first.');
            return;
        }

        setAssigning(true);
        setApiBannerMsg(null);

        try {
            let payload = { mailboxIds: selectedMailboxIds };

            if (distributionMode === 'single') {
                if (!targetAssignUser) {
                    alert('Please select a team member.');
                    setAssigning(false);
                    return;
                }
                payload.targetUserId = targetAssignUser;
            } else {
                // Hybrid mode (custom count inputs with equal default)
                const distributions = Object.entries(manualCounts)
                    .filter(([userId]) => selectedAssignUsers.includes(userId))
                    .map(([userId, count]) => ({ userId, count: Math.max(0, parseInt(count, 10) || 0) }))
                    .filter(d => d.count > 0);

                if (distributions.length === 0) {
                    alert('Please allocate at least 1 mailbox to an eligible team member.');
                    setAssigning(false);
                    return;
                }
                payload.distributionMode = 'manual';
                payload.distributions = distributions;
            }

            const { data } = await api.post('/mailboxes/assign', payload);
            setApiBannerMsg({ type: 'success', text: data.message });
            setAssignModalOpen(false);
            setSelectedMailboxIds([]);
            await fetchMailboxes();
        } catch (err) {
            setApiBannerMsg({ type: 'error', text: err.response?.data?.message || 'Assignment failed' });
        } finally {
            setAssigning(false);
        }
    };

    const handleBulkStatus = async (status) => {
        if (selectedMailboxIds.length === 0) {
            alert('Please select at least one mailbox first.');
            return;
        }
        setBulkUpdatingStatus(true);
        setApiBannerMsg(null);
        try {
            const { data } = await api.put('/mailboxes/bulk-status', {
                mailboxIds: selectedMailboxIds,
                status
            });
            setApiBannerMsg({ 
                type: 'success', 
                text: `✓ ${data.message} (Real Hostinger email accounts remain 100% safe & untouched).` 
            });
            await fetchMailboxes();
        } catch (err) {
            setApiBannerMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update mailbox status' });
        } finally {
            setBulkUpdatingStatus(false);
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


    const filteredMailboxes = mailboxes.filter(m => {
        // Status & assignment filter
        if (assignedFilter === 'active' && m.status !== 'active') return false;
        if (assignedFilter === 'paused' && m.status !== 'paused') return false;
        if (assignedFilter === 'unassigned' && m.assignedTo) return false;
        if (!['all', 'active', 'paused', 'unassigned'].includes(assignedFilter)) {
            if ((m.assignedTo?._id || m.assignedTo) !== assignedFilter) return false;
        }

        // Provider filter
        if (providerFilter === 'cloudflare') {
            const isCf = m.provider === 'cloudflare' || m.provider === 'gmail' || (m.emailUser && m.emailUser.endsWith('@untressed.com')) || (m.smtpHost && m.smtpHost.includes('gmail.com'));
            if (!isCf) return false;
        } else if (providerFilter === 'hostinger') {
            if (m.provider !== 'hostinger') return false;
        } else if (providerFilter === 'custom') {
            if (!['custom', 'brevo', 'resend', 'outlook'].includes(m.provider)) return false;
        }

        // Search query
        if (searchFilter.trim()) {
            const q = searchFilter.trim().toLowerCase();
            const matchEmail = m.emailUser && m.emailUser.toLowerCase().includes(q);
            const matchName = m.senderName && m.senderName.toLowerCase().includes(q);
            if (!matchEmail && !matchName) return false;
        }

        return true;
    });

    const activeCount = filteredMailboxes.filter(m => m.status === 'active').length;
    const totalDailyCapacity = filteredMailboxes.filter(m => m.status === 'active').reduce((acc, m) => acc + (m.dailyLimit || 100), 0);
    const sentTodayCount = filteredMailboxes.reduce((acc, m) => acc + (m.sentToday || 0), 0);

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '6px' }}>Mailbox Dashboard</h1>
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                        Unified fleet of all active mailboxes and outreach identities (Hostinger inboxes, Gmail, Cloudflare domain aliases, and Custom SMTP). Monitored for daily quotas and warm-up deliverability.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button 
                        onClick={fetchMailboxes} 
                        className="btn-secondary" 
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        title="Refresh Mailbox Status"
                    >
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                        <span>Refresh Status</span>
                    </button>
                    <Link
                        to="/email-settings"
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
                    >
                        <Settings size={17} />
                        <span>+ Connect & Authenticate Mailboxes ↗</span>
                    </Link>
                </div>
            </header>

            {/* Operational Fleet Command Center */}
            <div 
                className="glass-panel" 
                style={{ 
                    marginBottom: '28px', 
                    padding: '20px 24px', 
                    background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.4) 0%, rgba(15, 23, 42, 0.7) 100%)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    boxShadow: '0 8px 32px -8px rgba(124, 58, 237, 0.15)',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            boxShadow: '0 4px 14px rgba(124, 58, 237, 0.4)'
                        }}>
                            <Server size={22} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>Multi-Provider Sending Fleet</h2>
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '3px 10px',
                                    borderRadius: '20px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    color: '#10b981',
                                    border: '1px solid rgba(16, 185, 129, 0.3)'
                                }}>
                                    <CheckCircle2 size={12} />
                                    {mailboxes.filter(m => m.status === 'active').length} Active Senders
                                </span>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', margin: '4px 0 0 0' }}>
                                Centralized sender network • Automatic round-robin rotation for outreach campaigns • Live deliverability monitoring
                            </p>
                        </div>
                    </div>

                    {/* Operational Quick Actions */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            onClick={handleSyncInbox}
                            disabled={syncingInbox}
                            style={{
                                background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
                                color: '#ffffff',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '12.5px',
                                cursor: syncingInbox ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '7px',
                                boxShadow: '0 4px 12px rgba(6, 182, 212, 0.25)'
                            }}
                            title="Sync received replies and check all inboxes"
                        >
                            <Inbox size={15} className={syncingInbox ? 'spin' : ''} />
                            <span>{syncingInbox ? 'Checking Inboxes...' : '📥 Sync Received Replies'}</span>
                        </button>
                    </div>
                </div>

                {/* Banner Message */}
                {apiBannerMsg && (
                    <div style={{
                        marginTop: '16px',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        background: apiBannerMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        border: `1px solid ${apiBannerMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        color: apiBannerMsg.type === 'success' ? '#10b981' : '#ef4444',
                        fontSize: '12.5px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {apiBannerMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                            <span>{apiBannerMsg.text}</span>
                        </div>
                        <button onClick={() => setApiBannerMsg(null)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px' }}>
                            <X size={14} />
                        </button>
                    </div>
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

            {/* Compact Mailbox Filter & Bulk Action Toolbar */}
            <div className="glass-panel" style={{
                position: 'relative',
                zIndex: 40,
                padding: '10px 14px',
                marginBottom: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: selectedMailboxIds.length > 0 ? '10px' : '0px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)',
                borderRadius: '10px',
                transition: 'all 0.2s ease'
            }}>
                {/* Row 1: High-Density Inline Filters & Select All */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    {/* Left: Filter Pills & Assignee Dropdown */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)', fontSize: '12px', marginRight: '4px' }}>
                            <Filter size={13} />
                            <span style={{ fontWeight: 600 }}>Filter:</span>
                        </div>

                        {/* All */}
                        <button
                            onClick={() => setAssignedFilter('all')}
                            style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer',
                                background: assignedFilter === 'all' ? 'var(--accent-color, #7c3aed)' : 'var(--bg-secondary)',
                                color: assignedFilter === 'all' ? '#fff' : 'var(--text-secondary)',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            All ({mailboxes.length})
                        </button>

                        {/* Active */}
                        <button
                            onClick={() => setAssignedFilter('active')}
                            style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer',
                                background: assignedFilter === 'active' ? '#10b981' : 'var(--bg-secondary)',
                                color: assignedFilter === 'active' ? '#fff' : 'var(--text-secondary)',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Active ({mailboxes.filter(m => m.status === 'active').length})
                        </button>

                        {/* Paused */}
                        <button
                            onClick={() => setAssignedFilter('paused')}
                            style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer',
                                background: assignedFilter === 'paused' ? '#f59e0b' : 'var(--bg-secondary)',
                                color: assignedFilter === 'paused' ? '#fff' : 'var(--text-secondary)',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Paused ({mailboxes.filter(m => m.status === 'paused').length})
                        </button>

                        {/* Unassigned (Admins only) */}
                        {isMasterOrAdmin && (
                            <button
                                onClick={() => setAssignedFilter('unassigned')}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: assignedFilter === 'unassigned' ? 'var(--accent-color, #7c3aed)' : 'var(--bg-secondary)',
                                    color: assignedFilter === 'unassigned' ? '#fff' : 'var(--text-secondary)',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                Unassigned ({mailboxes.filter(m => !m.assignedTo).length})
                            </button>
                        )}

                        {/* Filter by Team Member Dropdown */}
                        {isMasterOrAdmin && usersList.length > 0 && (
                            <div style={{ marginLeft: '4px' }}>
                                <CustomDropdown
                                    value={['all', 'active', 'paused', 'unassigned'].includes(assignedFilter) ? '' : assignedFilter}
                                    onChange={val => setAssignedFilter(val || 'all')}
                                    placeholder="By Team Member..."
                                    options={[
                                        { value: '', label: 'All Team Members' },
                                        ...usersList.map(u => ({
                                            value: u._id,
                                            label: `${u.name} (${mailboxes.filter(m => (m.assignedTo?._id || m.assignedTo) === u._id).length} inboxes)`
                                        }))
                                    ]}
                                    width="200px"
                                />
                            </div>
                        )}
                        {/* Divider */}
                        <div style={{ height: '16px', width: '1px', background: 'var(--border-color)', margin: '0 4px' }} />

                        {/* Provider Filter: All / Cloudflare Aliases / Hostinger / Custom */}
                        <button
                            onClick={() => setProviderFilter('all')}
                            style={{
                                padding: '4px 9px',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer',
                                background: providerFilter === 'all' ? '#6366f1' : 'var(--bg-secondary)',
                                color: providerFilter === 'all' ? '#fff' : 'var(--text-secondary)'
                            }}
                        >
                            All Providers
                        </button>
                        <button
                            onClick={() => setProviderFilter('cloudflare')}
                            style={{
                                padding: '4px 9px',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer',
                                background: providerFilter === 'cloudflare' ? 'linear-gradient(135deg, #f97316 0%, #7c3aed 100%)' : 'var(--bg-secondary)',
                                color: providerFilter === 'cloudflare' ? '#fff' : 'var(--text-secondary)'
                            }}
                            title="Filter Cloudflare Aliases & Gmail master"
                        >
                            Cloudflare Aliases ({mailboxes.filter(m => m.provider === 'cloudflare' || m.provider === 'gmail' || (m.emailUser && m.emailUser.endsWith('@untressed.com')) || (m.smtpHost && m.smtpHost.includes('gmail.com'))).length})
                        </button>
                        <button
                            onClick={() => setProviderFilter('hostinger')}
                            style={{
                                padding: '4px 9px',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer',
                                background: providerFilter === 'hostinger' ? '#7c3aed' : 'var(--bg-secondary)',
                                color: providerFilter === 'hostinger' ? '#fff' : 'var(--text-secondary)'
                            }}
                        >
                            Hostinger ({mailboxes.filter(m => m.provider === 'hostinger').length})
                        </button>
                    </div>

                    {/* Right: Search Box & Select All Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                            <input
                                type="text"
                                placeholder="Search email/name..."
                                value={searchFilter}
                                onChange={(e) => setSearchFilter(e.target.value)}
                                style={{
                                    height: '30px',
                                    paddingLeft: '26px',
                                    paddingRight: '10px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '12px',
                                    width: '160px'
                                }}
                            />
                        </div>
                        <button
                            onClick={toggleSelectAll}
                            className="btn-secondary"
                            style={{ padding: '4px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', height: '30px' }}
                        >
                            {selectedMailboxIds.length === filteredMailboxes.length && filteredMailboxes.length > 0 ? (
                                <>
                                    <CheckSquare size={14} style={{ color: '#10b981' }} />
                                    <span>Deselect All</span>
                                </>
                            ) : (
                                <>
                                    <Square size={14} />
                                    <span>Select All ({filteredMailboxes.length})</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Row 2: Bulk Actions Command Bar (Appears when mailboxes are checked) */}
                {selectedMailboxIds.length > 0 && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                        padding: '6px 12px',
                        background: 'rgba(124, 58, 237, 0.08)',
                        borderRadius: '8px',
                        border: '1px solid rgba(124, 58, 237, 0.25)'
                    }}>
                        {/* Status Toggle Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#c4b5fd', marginRight: '4px' }}>
                                {selectedMailboxIds.length} selected:
                            </span>

                            {/* Bulk Active Button */}
                            <button
                                onClick={() => handleBulkStatus('active')}
                                disabled={bulkUpdatingStatus}
                                style={{
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    color: '#10b981',
                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                    padding: '5px 12px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: bulkUpdatingStatus ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    transition: 'all 0.15s ease'
                                }}
                                title="Activate selected mailboxes for CRM campaign outreach (does not modify real Hostinger accounts)"
                            >
                                <PlayCircle size={13} />
                                <span>{bulkUpdatingStatus ? 'Updating...' : 'Set Active'}</span>
                            </button>

                            {/* Bulk Inactive / Pause Button */}
                            <button
                                onClick={() => handleBulkStatus('paused')}
                                disabled={bulkUpdatingStatus}
                                style={{
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    color: '#f59e0b',
                                    border: '1px solid rgba(245, 158, 11, 0.4)',
                                    padding: '5px 12px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: bulkUpdatingStatus ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    transition: 'all 0.15s ease'
                                }}
                                title="Pause selected mailboxes to prevent CRM outreach sending (original Hostinger mailboxes stay untouched)"
                            >
                                <PauseCircle size={13} />
                                <span>{bulkUpdatingStatus ? 'Updating...' : 'Set Paused / Inactive'}</span>
                            </button>
                        </div>

                        {/* Assignment & Multi-User Distribution Controls (Admins & Master only) */}
                        {isMasterOrAdmin && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                {/* Smart Equal / Manual Distribution Modal Trigger */}
                                <button
                                    onClick={openAssignModal}
                                    style={{
                                        background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '5px 14px',
                                        borderRadius: '6px',
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        boxShadow: '0 2px 8px rgba(124, 58, 237, 0.35)',
                                        transition: 'all 0.15s ease'
                                    }}
                                    title="Distribute mailboxes equally or manually across multiple admins/team members"
                                >
                                    <Scale size={13} />
                                    <span>Distribute / Assign ({selectedMailboxIds.length})...</span>
                                </button>

                                <div style={{ height: '18px', width: '1px', background: 'var(--border-color)', margin: '0 2px' }} />

                                {/* Quick Single Assignee Dropdown */}
                                <CustomDropdown
                                    value={targetAssignUser}
                                    onChange={val => setTargetAssignUser(val)}
                                    placeholder="Quick 1-user assign..."
                                    options={[
                                        { value: '', label: 'Quick Assign to...' },
                                        ...usersList.map(u => ({
                                            value: u._id,
                                            label: `${u.name} (${u.role})`
                                        }))
                                    ]}
                                    width="170px"
                                />
                                <button
                                    onClick={() => handleAssignMailboxes(null)}
                                    disabled={assigning || !targetAssignUser}
                                    style={{
                                        background: targetAssignUser ? '#7c3aed' : 'var(--bg-secondary)',
                                        color: targetAssignUser ? '#fff' : 'var(--text-dim)',
                                        border: 'none',
                                        padding: '5px 12px',
                                        borderRadius: '6px',
                                        fontWeight: 600,
                                        fontSize: '12px',
                                        cursor: assigning || !targetAssignUser ? 'not-allowed' : 'pointer'
                                    }}
                                    title="Assign all selected to this single user"
                                >
                                    {assigning ? '...' : 'Assign'}
                                </button>

                                <button
                                    onClick={() => handleAssignMailboxes('unassign')}
                                    disabled={assigning}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        color: '#ef4444',
                                        border: '1px solid rgba(239, 68, 68, 0.35)',
                                        padding: '5px 10px',
                                        borderRadius: '6px',
                                        fontWeight: 600,
                                        fontSize: '12px',
                                        cursor: 'pointer'
                                    }}
                                    title="Unassign selected mailboxes back to master pool"
                                >
                                    Unassign
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

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
                                                {/* Provider badge */}
                                                {(() => {
                                                    const isCf = mb.provider === 'cloudflare' || (mb.emailUser && mb.emailUser.endsWith('@untressed.com')) || (mb.smtpHost && mb.smtpHost.includes('gmail.com') && mb.provider !== 'gmail');
                                                    if (isCf) {
                                                        return (
                                                            <span style={{
                                                                fontSize: '10px',
                                                                fontWeight: 700,
                                                                padding: '2px 8px',
                                                                borderRadius: '6px',
                                                                background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(124, 58, 237, 0.2) 100%)',
                                                                color: '#fb923c',
                                                                border: '1px solid rgba(249, 115, 22, 0.35)',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '3px'
                                                            }}>
                                                                <Globe size={10} /> Cloudflare Alias
                                                            </span>
                                                        );
                                                    }
                                                    if (mb.provider === 'gmail') {
                                                        return (
                                                            <span style={{
                                                                fontSize: '10px',
                                                                fontWeight: 700,
                                                                padding: '2px 8px',
                                                                borderRadius: '6px',
                                                                background: 'rgba(239, 68, 68, 0.15)',
                                                                color: '#f87171',
                                                                border: '1px solid rgba(239, 68, 68, 0.3)'
                                                            }}>
                                                                Google Mail
                                                            </span>
                                                        );
                                                    }
                                                    if (mb.provider === 'hostinger') {
                                                        return (
                                                            <span style={{
                                                                fontSize: '10px',
                                                                fontWeight: 700,
                                                                padding: '2px 8px',
                                                                borderRadius: '6px',
                                                                background: 'rgba(103, 58, 183, 0.2)',
                                                                color: '#a78bfa',
                                                                border: '1px solid rgba(139, 92, 246, 0.3)'
                                                            }}>
                                                                Hostinger
                                                            </span>
                                                        );
                                                    }
                                                    return (
                                                        <span style={{
                                                            fontSize: '10px',
                                                            fontWeight: 700,
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            background: 'rgba(255, 255, 255, 0.1)',
                                                            color: 'var(--text-secondary)'
                                                        }}>
                                                            {mb.provider}
                                                        </span>
                                                    );
                                                })()}
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


            {/* Modal: Smart Multi-User Mailbox Assignment & Distribution (Equal / Manual / Single) */}
            {assignModalOpen && (
                <div className="modal-overlay" onClick={() => !assigning && setAssignModalOpen(false)}>
                    <div className="glass-panel modal-card animate-modal-in" style={{ maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(124, 58, 237, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>
                                    <Scale size={20} />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Assign & Distribute Mailboxes</h2>
                                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                                        Distribute <strong style={{ color: 'var(--text-primary)' }}>{selectedMailboxIds.length} selected mailbox(es)</strong> across team members
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => !assigning && setAssignModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Role-Based Assignment Security Notice */}
                        <div style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: user?.role === 'admin' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                            border: `1px solid ${user?.role === 'admin' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(139, 92, 246, 0.25)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '12px',
                            fontSize: '12px'
                        }}>
                            <ShieldCheck size={16} color={user?.role === 'admin' ? '#10b981' : '#a78bfa'} />
                            <span style={{ color: 'var(--text-primary)' }}>
                                {user?.role === 'admin' 
                                    ? 'Admin Panel Policy: Mailboxes can ONLY be assigned to Mail Pedia members. (Sales reps cannot receive mailboxes).'
                                    : 'Master Architecture Policy: Mailboxes can be assigned to Admin and Mail Pedia members. (Sales reps cannot receive mailboxes).'}
                            </span>
                        </div>

                        {/* Mode Selector Tabs (Hybrid vs Single) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginBottom: '14px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px' }}>
                            <button
                                type="button"
                                onClick={() => setDistributionMode('hybrid')}
                                style={{
                                    padding: '7px 14px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    fontSize: '12.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    background: distributionMode === 'hybrid' ? 'var(--accent-color, #7c3aed)' : 'transparent',
                                    color: distributionMode === 'hybrid' ? '#fff' : 'var(--text-secondary)',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <Scale size={14} />
                                <span>Smart Distribution (Auto-Equal + Manual Override)</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setDistributionMode('single')}
                                style={{
                                    padding: '7px 14px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    fontSize: '12.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    background: distributionMode === 'single' ? 'var(--accent-color, #7c3aed)' : 'transparent',
                                    color: distributionMode === 'single' ? '#fff' : 'var(--text-secondary)',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <Users size={14} />
                                <span>Single User</span>
                            </button>
                        </div>

                        {/* Modal Body / Scrollable Area */}
                        <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '14px' }}>
                            {distributionMode === 'hybrid' && (() => {
                                const totalAllocated = Object.entries(manualCounts)
                                    .filter(([uid]) => selectedAssignUsers.includes(uid))
                                    .reduce((acc, [, val]) => acc + (parseInt(val, 10) || 0), 0);
                                const remaining = selectedMailboxIds.length - totalAllocated;

                                return (
                                    <div>
                                        {/* Allocation Ribbon */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '8px 14px',
                                            borderRadius: '8px',
                                            background: remaining === 0 ? 'rgba(16, 185, 129, 0.12)' : remaining > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                            border: `1px solid ${remaining === 0 ? 'rgba(16, 185, 129, 0.3)' : remaining > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                            marginBottom: '12px'
                                        }}>
                                            <div>
                                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Selected Pool:</span>
                                                <strong style={{ fontSize: '14px', color: 'var(--text-primary)', marginLeft: '6px' }}>{selectedMailboxIds.length}</strong>
                                            </div>
                                            <div>
                                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Allocated:</span>
                                                <strong style={{ fontSize: '14px', color: 'var(--text-primary)', marginLeft: '6px' }}>{totalAllocated}</strong>
                                            </div>
                                            <div>
                                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Remaining:</span>
                                                <strong style={{ fontSize: '14px', color: remaining === 0 ? '#10b981' : remaining > 0 ? '#f59e0b' : '#ef4444', marginLeft: '6px' }}>
                                                    {remaining}
                                                </strong>
                                            </div>
                                        </div>

                                        {/* Quick Action Controls */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                Eligible Assignees ({usersList.length}):
                                            </span>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    type="button"
                                                    onClick={rebalanceEqually}
                                                    style={{
                                                        background: 'rgba(124, 58, 237, 0.15)',
                                                        border: '1px solid rgba(124, 58, 237, 0.35)',
                                                        color: '#c4b5fd',
                                                        padding: '3px 9px',
                                                        borderRadius: '5px',
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                    title="Recalculate equal distribution across all checked team members"
                                                >
                                                    <Scale size={12} />
                                                    <span>⚖️ Auto-Divide Equally</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={toggleSelectAllAssignUsers}
                                                    style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                                                >
                                                    {selectedAssignUsers.length === usersList.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* User List with Live Inputs */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {usersList.map(u => {
                                                const isIncluded = selectedAssignUsers.includes(u._id);
                                                const currentTotal = mailboxes.filter(m => (m.assignedTo?._id || m.assignedTo) === u._id).length;
                                                const allocatedVal = manualCounts[u._id] !== undefined ? manualCounts[u._id] : 0;

                                                return (
                                                    <div
                                                        key={u._id}
                                                        style={{
                                                            padding: '9px 12px',
                                                            borderRadius: '8px',
                                                            border: `1px solid ${isIncluded ? 'rgba(124, 58, 237, 0.35)' : 'var(--border-color)'}`,
                                                            background: isIncluded ? 'rgba(124, 58, 237, 0.06)' : 'var(--bg-card)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            gap: '10px',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                    >
                                                        {/* Checkbox & User Info */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 1, minWidth: 0 }}>
                                                            <div 
                                                                onClick={() => toggleAssignUser(u._id)} 
                                                                style={{ cursor: 'pointer', color: isIncluded ? '#a78bfa' : 'var(--text-dim)', flexShrink: 0 }}
                                                            >
                                                                {isIncluded ? <CheckSquare size={16} /> : <Square size={16} />}
                                                            </div>
                                                            <div style={{ minWidth: 0 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                        {u.name}
                                                                    </span>
                                                                    <span style={{
                                                                        fontSize: '9.5px',
                                                                        padding: '1px 5px',
                                                                        borderRadius: '4px',
                                                                        background: u.role === 'mail_pedia' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.2)',
                                                                        color: u.role === 'mail_pedia' ? '#10b981' : '#a78bfa',
                                                                        fontWeight: 700,
                                                                        textTransform: 'uppercase'
                                                                    }}>
                                                                        {u.role === 'mail_pedia' ? 'Mail Pedia' : u.role}
                                                                    </span>
                                                                </div>
                                                                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                                                    Currently has: <strong>{currentTotal}</strong> inboxes
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Live Number Stepper & Fill Remaining */}
                                                        {isIncluded ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max={selectedMailboxIds.length}
                                                                    value={allocatedVal}
                                                                    onChange={e => {
                                                                        const parsed = Math.max(0, parseInt(e.target.value, 10) || 0);
                                                                        setManualCounts(prev => ({ ...prev, [u._id]: parsed }));
                                                                    }}
                                                                    style={{
                                                                        width: '70px',
                                                                        padding: '5px 8px',
                                                                        borderRadius: '6px',
                                                                        border: '1px solid var(--border-color)',
                                                                        background: 'var(--bg-secondary)',
                                                                        color: 'var(--text-primary)',
                                                                        fontSize: '12.5px',
                                                                        fontWeight: 700,
                                                                        textAlign: 'center'
                                                                    }}
                                                                />
                                                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>inboxes</span>

                                                                {remaining > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setManualCounts(prev => ({ ...prev, [u._id]: (parseInt(prev[u._id], 10) || 0) + remaining }));
                                                                        }}
                                                                        style={{
                                                                            padding: '3px 8px',
                                                                            borderRadius: '5px',
                                                                            background: 'rgba(124, 58, 237, 0.15)',
                                                                            border: '1px solid rgba(124, 58, 237, 0.3)',
                                                                            color: '#a78bfa',
                                                                            fontSize: '10.5px',
                                                                            fontWeight: 600,
                                                                            cursor: 'pointer',
                                                                            whiteSpace: 'nowrap'
                                                                        }}
                                                                        title="Allocate remaining unassigned mailboxes to this user"
                                                                    >
                                                                        +{remaining}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Excluded</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Mode 2: Single User */}
                            {distributionMode === 'single' && (
                                <div style={{ padding: '8px 0' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                        Select the team member to receive all {selectedMailboxIds.length} mailboxes:
                                    </label>
                                    <CustomDropdown
                                        value={targetAssignUser}
                                        onChange={val => setTargetAssignUser(val)}
                                        placeholder="Select Assignee..."
                                        options={[
                                            { value: '', label: 'Select Assignee...' },
                                            ...usersList.map(u => ({
                                                value: u._id,
                                                label: `${u.name} (${u.role === 'mail_pedia' ? 'Mail Pedia' : u.role} - ${mailboxes.filter(m => (m.assignedTo?._id || m.assignedTo) === u._id).length} inboxes)`
                                            }))
                                        ]}
                                        width="100%"
                                    />
                                    {targetAssignUser && (
                                        <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(124, 58, 237, 0.25)', fontSize: '13px' }}>
                                            🎯 All <strong>{selectedMailboxIds.length} mailboxes</strong> will be assigned to <strong>{usersList.find(u => u._id === targetAssignUser)?.name}</strong>.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                            <button
                                type="button"
                                onClick={() => setAssignModalOpen(false)}
                                className="btn-secondary"
                                disabled={assigning}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDistributedAssign}
                                className="btn-primary"
                                disabled={assigning || (distributionMode === 'hybrid' && selectedAssignUsers.length === 0) || (distributionMode === 'single' && !targetAssignUser)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px', fontWeight: 700 }}
                            >
                                {assigning ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                <span>{assigning ? 'Assigning...' : `Confirm & Distribute (${selectedMailboxIds.length} Inboxes)`}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MailboxManager;
