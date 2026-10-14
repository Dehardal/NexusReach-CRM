import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { 
    Send, Plus, Sparkles, CheckCircle2, Clock, Users, Mail, 
    AlertCircle, ArrowRight, Trash2, Eye, RefreshCw, BarChart3, 
    Search, Check, X, ShieldCheck, MailCheck, Layers, ChevronRight,
    Zap, AlertTriangle, ExternalLink
} from 'lucide-react';

const CampaignManager = () => {
    const { api, socket, user } = useAuth();
    const [campaigns, setCampaigns] = useState([]);
    const [mailboxes, setMailboxes] = useState([]);
    const [leadsCount, setLeadsCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Modals
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [detailsCampaign, setDetailsCampaign] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    // Filter & Search
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Create Campaign Form state
    const [name, setName] = useState('');
    const [subject, setSubject] = useState('');
    const [bodyHtml, setBodyHtml] = useState('');
    const [selectedMailboxes, setSelectedMailboxes] = useState([]);
    const [aiPrompt, setAiPrompt] = useState('');
    const [generatingAi, setGeneratingAi] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [activeStep, setActiveStep] = useState(1); // 1: Senders & Setup, 2: Compose & AI, 3: Live Preview
    const [mailboxSearch, setMailboxSearch] = useState('');
    const textareaRef = useRef(null);

    // Active progress stream
    const [activeProgress, setActiveProgress] = useState(null);

    const fetchData = async (isManualRefresh = false) => {
        if (isManualRefresh) setRefreshing(true);
        try {
            const [cRes, mRes, lRes] = await Promise.all([
                api.get('/campaigns'),
                api.get('/mailboxes'),
                api.get('/leads?limit=1')
            ]);
            setCampaigns(cRes.data || []);
            setMailboxes((mRes.data || []).filter(m => m.status === 'active'));
            setLeadsCount(lRes.data.total || 0);
        } catch (err) {
            console.error('[CAMPAIGN MANAGER] Error fetching data:', err);
        } finally {
            setLoading(false);
            if (isManualRefresh) setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();

        if (socket) {
            socket.on('campaign_progress', (data) => {
                setActiveProgress(data);
                if (data.percent >= 100) {
                    fetchData();
                }
            });

            return () => {
                socket.off('campaign_progress');
            };
        }
    }, [socket]);

    const openCreateModal = () => {
        setName(`Cold Outreach Sequence #${campaigns.length + 1}`);
        setSubject('Quick question regarding your upcoming program goals, {{firstName}}');
        setBodyHtml(`<p>Hi {{firstName}},</p>\n<p>I noticed your interest in advancing your career goals with our upcoming cohort.</p>\n<p>We are opening priority admissions this week and would love to share curriculum details and scholarship opportunities with you.</p>\n<p>Do you have 5 minutes for a quick chat this Thursday or Friday?</p>\n<p>Best regards,<br/><strong>Admissions & Outreach Team</strong></p>`);
        setSelectedMailboxes(mailboxes.map(m => m._id));
        setAiPrompt('');
        setActiveStep(1);
        setMailboxSearch('');
        setCreateModalOpen(true);
    };

    const handleGenerateAi = async (overridePrompt) => {
        const promptToUse = (typeof overridePrompt === 'string' ? overridePrompt : aiPrompt).trim();
        if (!promptToUse) {
            alert('Please enter a brief topic or select a suggested prompt.');
            return;
        }

        setGeneratingAi(true);
        try {
            const { data } = await api.post('/scraper/generate-pitch', {
                companyName: 'Admissions Academy',
                services: promptToUse,
                industry: 'Education & Admissions'
            }).catch(() => null) || {};

            if (data?.pitch) {
                setSubject(`Exciting opportunity for you, {{firstName}}`);
                setBodyHtml(`<p>Hi {{firstName}},</p>\n<p>${data.pitch.replace(/\n/g, '</p><p>')}</p>\n<p>Best regards,<br/><strong>Admissions Department</strong></p>`);
            } else {
                setSubject(`Invitation: Explore career advancement programs with us, {{firstName}}`);
                setBodyHtml(`<p>Hello {{firstName}},</p>\n<p>We are reaching out to prospective candidates interested in elevating their careers through our specialized programs in {{course}}.</p>\n<p>Our upcoming admissions round includes scholarship opportunities for eligible applicants in {{city}}.</p>\n<p>Reply directly to this email if you would like us to send the detailed prospectus.</p>\n<p>Warm regards,<br/><strong>Admissions Office</strong></p>`);
            }
        } catch (err) {
            console.error('[AI CAMPAIGN ERROR]', err);
        } finally {
            setGeneratingAi(false);
        }
    };

    const handleCreateCampaign = async (e) => {
        e.preventDefault();
        if (selectedMailboxes.length === 0) {
            alert('Please select at least one Hostinger mailbox to send from.');
            return;
        }

        setSubmitting(true);
        try {
            await api.post('/campaigns', {
                name,
                subject,
                bodyHtml,
                mailboxIds: selectedMailboxes,
                autoLaunch: true
            });

            setCreateModalOpen(false);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Error launching campaign');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteCampaign = async (id, e) => {
        if (e) e.stopPropagation();
        try {
            await api.delete(`/campaigns/${id}`);
            setCampaigns(prev => prev.filter(c => c._id !== id));
            setDeleteConfirmId(null);
            if (detailsCampaign?._id === id) {
                setDetailsCampaign(null);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete campaign');
        }
    };

    const toggleMailboxSelection = (id) => {
        if (selectedMailboxes.includes(id)) {
            setSelectedMailboxes(selectedMailboxes.filter(m => m !== id));
        } else {
            setSelectedMailboxes([...selectedMailboxes, id]);
        }
    };

    const selectAllMailboxes = () => {
        if (selectedMailboxes.length === mailboxes.length) {
            setSelectedMailboxes([]);
        } else {
            setSelectedMailboxes(mailboxes.map(m => m._id));
        }
    };

    const insertVariable = (tag) => {
        if (!textareaRef.current) {
            setBodyHtml(prev => prev + ` ${tag} `);
            return;
        }
        const textarea = textareaRef.current;
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const before = bodyHtml.substring(0, start);
        const after = bodyHtml.substring(end);
        const nextValue = before + ` ${tag} ` + after;
        setBodyHtml(nextValue);

        setTimeout(() => {
            textarea.focus();
            const nextCursor = start + tag.length + 2;
            textarea.setSelectionRange(nextCursor, nextCursor);
        }, 10);
    };

    // Calculate High-Level Metrics
    const totalCampaigns = campaigns.length;
    const totalRecipients = campaigns.reduce((acc, c) => acc + (c.totalRecipients || 0), 0);
    const totalSent = campaigns.reduce((acc, c) => acc + (c.sentCount || 0), 0);
    const totalFailed = campaigns.reduce((acc, c) => acc + (c.failedCount || 0), 0);
    const overallSuccessRate = (totalSent + totalFailed) > 0 
        ? Math.round((totalSent / (totalSent + totalFailed)) * 100) 
        : 100;
    const totalPoolDailyCapacity = mailboxes.reduce((acc, m) => acc + (m.dailyLimit || 100), 0);

    // Filtered campaigns
    const filteredCampaigns = campaigns.filter(c => {
        const matchesSearch = 
            c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.createdBy?.name?.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (!matchesSearch) return false;
        if (statusFilter === 'all') return true;
        return c.status === statusFilter;
    });

    const statusCounts = {
        all: campaigns.length,
        sending: campaigns.filter(c => c.status === 'sending').length,
        completed: campaigns.filter(c => c.status === 'completed').length,
        draft: campaigns.filter(c => c.status === 'draft').length,
        failed: campaigns.filter(c => c.status === 'failed').length
    };

    // Helper for sample rendered preview
    const renderPreviewHtml = (rawHtml) => {
        if (!rawHtml) return '<em>No email content provided yet.</em>';
        return rawHtml
            .replace(/{{firstName}}/gi, 'Alex')
            .replace(/{{name}}/gi, 'Alex Rivera')
            .replace(/{{course}}/gi, 'Executive Leadership & AI')
            .replace(/{{city}}/gi, 'New York')
            .replace(/{{email}}/gi, 'alex.rivera@example.com')
            .replace(/{{phone}}/gi, '+1 (555) 019-2834');
    };

    const getStatusBadgeStyle = (status) => {
        switch (status) {
            case 'completed':
                return {
                    bg: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    border: 'rgba(16, 185, 129, 0.25)',
                    label: 'Completed'
                };
            case 'sending':
                return {
                    bg: 'rgba(6, 182, 212, 0.12)',
                    color: '#06b6d4',
                    border: 'rgba(6, 182, 212, 0.25)',
                    label: 'Sending...'
                };
            case 'failed':
                return {
                    bg: 'rgba(239, 68, 68, 0.12)',
                    color: '#ef4444',
                    border: 'rgba(239, 68, 68, 0.25)',
                    label: 'Failed'
                };
            case 'draft':
            default:
                return {
                    bg: 'rgba(245, 158, 11, 0.12)',
                    color: '#f59e0b',
                    border: 'rgba(245, 158, 11, 0.25)',
                    label: 'Draft / Queued'
                };
        }
    };

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '40px' }}>
            {/* Header Section */}
            <header style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                flexWrap: 'wrap', 
                gap: '16px', 
                marginBottom: '28px' 
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                            Email Campaigns
                        </h1>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: 600,
                            background: mailboxes.length > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: mailboxes.length > 0 ? '#10b981' : '#ef4444',
                            border: `1px solid ${mailboxes.length > 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
                        }}>
                            <span style={{ 
                                width: '6px', 
                                height: '6px', 
                                borderRadius: '50%', 
                                background: mailboxes.length > 0 ? '#10b981' : '#ef4444',
                                boxShadow: mailboxes.length > 0 ? '0 0 8px #10b981' : 'none'
                            }} />
                            {mailboxes.length} Active {mailboxes.length === 1 ? 'Sender' : 'Senders'}
                        </span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', margin: 0 }}>
                        High-volume cold outreach sequences rotated automatically across your Hostinger sender pool.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        onClick={() => fetchData(true)}
                        disabled={refreshing}
                        className="btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 14px', fontSize: '13px' }}
                        title="Refresh campaigns"
                    >
                        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                        <span>Refresh</span>
                    </button>
                    
                    <button 
                        onClick={openCreateModal} 
                        disabled={mailboxes.length === 0}
                        className="btn-primary" 
                        style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            padding: '10px 18px', 
                            fontSize: '13px',
                            opacity: mailboxes.length === 0 ? 0.6 : 1
                        }}
                    >
                        <Plus size={16} />
                        <span>New Campaign</span>
                    </button>
                </div>
            </header>

            {/* Active Live Progress Bar if sending */}
            {activeProgress && activeProgress.percent < 100 && (
                <div className="glass-panel" style={{ 
                    padding: '18px 22px', 
                    marginBottom: '24px', 
                    border: '1px solid rgba(6, 182, 212, 0.4)', 
                    background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(59, 130, 246, 0.08))',
                    borderRadius: 'var(--radius-lg)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '8px',
                                background: 'rgba(6, 182, 212, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Zap size={15} style={{ color: '#06b6d4' }} className="animate-pulse" />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                                    Campaign Dispatch in Progress
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    Rotating across {mailboxes.length} Hostinger sender accounts
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: '#06b6d4' }}>
                                {activeProgress.sentCount} / {activeProgress.totalRecipients}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: '6px' }}>
                                ({activeProgress.percent}%)
                            </span>
                        </div>
                    </div>
                    <div style={{ 
                        width: '100%', 
                        height: '8px', 
                        background: 'rgba(255, 255, 255, 0.1)', 
                        borderRadius: '9999px', 
                        overflow: 'hidden' 
                    }}>
                        <div style={{ 
                            width: `${activeProgress.percent}%`, 
                            height: '100%', 
                            background: 'linear-gradient(90deg, #06b6d4, #3b82f6)', 
                            borderRadius: '9999px',
                            transition: 'width 0.4s ease' 
                        }} />
                    </div>
                </div>
            )}

            {/* Warning if no mailboxes */}
            {mailboxes.length === 0 && (
                <div style={{ 
                    background: 'rgba(245, 158, 11, 0.08)', 
                    border: '1px solid rgba(245, 158, 11, 0.25)', 
                    borderRadius: 'var(--radius-lg)', 
                    padding: '16px 20px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    marginBottom: '24px',
                    gap: '16px',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <AlertCircle size={22} style={{ color: '#f59e0b', flexShrink: 0 }} />
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#f59e0b' }}>
                                No Active Hostinger Mailboxes Connected
                            </div>
                            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                                Connect or verify at least one sender mailbox to enable cold sequence delivery.
                            </div>
                        </div>
                    </div>
                    <a 
                        href="/mailboxes"
                        className="btn-secondary"
                        style={{ 
                            fontSize: '12.5px', 
                            padding: '8px 14px', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            textDecoration: 'none',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <span>Connect Mailboxes</span>
                        <ChevronRight size={14} />
                    </a>
                </div>
            )}

            {/* KPI Stats Grid */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
                gap: '16px', 
                marginBottom: '28px' 
            }}>
                {/* Total Sequences */}
                <div className="glass-panel campaign-kpi-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Total Campaigns
                        </span>
                        <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '8px', 
                            background: 'rgba(139, 92, 246, 0.12)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: 'var(--accent-color)'
                        }}>
                            <Layers size={16} />
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                            {totalCampaigns}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '6px' }}>
                            {statusCounts.completed} completed • {statusCounts.sending} sending
                        </div>
                    </div>
                </div>

                {/* Total Recipients Targeted */}
                <div className="glass-panel campaign-kpi-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Recipients Targeted
                        </span>
                        <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '8px', 
                            background: 'rgba(59, 130, 246, 0.12)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: '#3b82f6'
                        }}>
                            <Users size={16} />
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                            {totalRecipients.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '6px' }}>
                            {leadsCount} total leads in database
                        </div>
                    </div>
                </div>

                {/* Delivered Successfully */}
                <div className="glass-panel campaign-kpi-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Emails Delivered
                        </span>
                        <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '8px', 
                            background: 'rgba(16, 185, 129, 0.12)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: '#10b981'
                        }}>
                            <MailCheck size={16} />
                        </div>
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span style={{ fontSize: '26px', fontWeight: 800, color: '#10b981', lineHeight: 1 }}>
                                {totalSent.toLocaleString()}
                            </span>
                            <span style={{ 
                                fontSize: '11px', 
                                fontWeight: 700, 
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                background: 'rgba(16, 185, 129, 0.12)', 
                                color: '#10b981' 
                            }}>
                                {overallSuccessRate}% Success
                            </span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '6px' }}>
                            {totalFailed} delivery bounces/failures
                        </div>
                    </div>
                </div>

                {/* Hostinger Senders & Capacity */}
                <div className="glass-panel campaign-kpi-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Sender Capacity
                        </span>
                        <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '8px', 
                            background: 'rgba(6, 182, 212, 0.12)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: '#06b6d4'
                        }}>
                            <ShieldCheck size={16} />
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                            {totalPoolDailyCapacity.toLocaleString()}<span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>/day</span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '6px' }}>
                            Across {mailboxes.length} active mailboxes
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Tabs & Search Controls */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                flexWrap: 'wrap', 
                gap: '14px', 
                marginBottom: '20px' 
            }}>
                {/* Status Tabs */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    <button 
                        className={`campaign-filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('all')}
                    >
                        <span>All</span>
                        <span style={{ opacity: 0.7, fontSize: '11px' }}>({statusCounts.all})</span>
                    </button>
                    <button 
                        className={`campaign-filter-tab ${statusFilter === 'sending' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('sending')}
                    >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#06b6d4' }} />
                        <span>Sending</span>
                        <span style={{ opacity: 0.7, fontSize: '11px' }}>({statusCounts.sending})</span>
                    </button>
                    <button 
                        className={`campaign-filter-tab ${statusFilter === 'completed' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('completed')}
                    >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                        <span>Completed</span>
                        <span style={{ opacity: 0.7, fontSize: '11px' }}>({statusCounts.completed})</span>
                    </button>
                    <button 
                        className={`campaign-filter-tab ${statusFilter === 'draft' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('draft')}
                    >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
                        <span>Draft</span>
                        <span style={{ opacity: 0.7, fontSize: '11px' }}>({statusCounts.draft})</span>
                    </button>
                    {statusCounts.failed > 0 && (
                        <button 
                            className={`campaign-filter-tab ${statusFilter === 'failed' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('failed')}
                        >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                            <span>Failed</span>
                            <span style={{ opacity: 0.7, fontSize: '11px' }}>({statusCounts.failed})</span>
                        </button>
                    )}
                </div>

                {/* Search Box */}
                <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
                    <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search campaigns or subjects..."
                        className="form-input"
                        style={{ paddingLeft: '34px', paddingRight: '28px', fontSize: '13px', height: '38px' }}
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Campaigns Grid / List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-secondary)' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto', display: 'block', color: 'var(--accent-color)' }} />
                    <span>Loading marketing campaigns...</span>
                </div>
            ) : filteredCampaigns.length === 0 ? (
                <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center' }}>
                    <div style={{ 
                        width: '56px', 
                        height: '56px', 
                        borderRadius: '16px', 
                        background: 'rgba(139, 92, 246, 0.1)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        margin: '0 auto 16px auto',
                        color: 'var(--accent-color)'
                    }}>
                        <Send size={28} />
                    </div>
                    <h3 style={{ fontSize: '19px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
                        {searchQuery || statusFilter !== 'all' ? 'No Matching Campaigns Found' : 'No Email Campaigns Launched Yet'}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 24px auto', fontSize: '13.5px', lineHeight: 1.6 }}>
                        {searchQuery || statusFilter !== 'all' 
                            ? 'Try clearing your search keyword or switching your status filter to view all campaigns.'
                            : 'Set up your first automated cold email sequence to rotate across your Hostinger sender mailboxes and engage leads.'
                        }
                    </p>
                    {searchQuery || statusFilter !== 'all' ? (
                        <button 
                            onClick={() => { setSearchQuery(''); setStatusFilter('all'); }} 
                            className="btn-secondary" 
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}
                        >
                            <span>Clear All Filters</span>
                        </button>
                    ) : (
                        <button 
                            onClick={openCreateModal} 
                            disabled={mailboxes.length === 0}
                            className="btn-primary" 
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13.5px' }}
                        >
                            <Plus size={16} />
                            <span>Create Your First Campaign</span>
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', 
                    gap: '20px' 
                }}>
                    {filteredCampaigns.map((c) => {
                        const statusBadge = getStatusBadgeStyle(c.status);
                        const progressPercent = c.totalRecipients > 0 
                            ? Math.min(100, Math.round((c.sentCount / c.totalRecipients) * 100)) 
                            : (c.status === 'completed' ? 100 : 0);

                        return (
                            <div 
                                key={c._id} 
                                className="glass-panel campaign-card"
                                onClick={() => setDetailsCampaign(c)}
                                style={{ cursor: 'pointer' }}
                            >
                                {/* Card Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3 style={{ 
                                            fontSize: '16px', 
                                            fontWeight: 700, 
                                            margin: '0 0 4px 0', 
                                            color: 'var(--text-primary)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {c.name}
                                        </h3>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>
                                            By <strong>{c.createdBy?.name || 'Admin'}</strong> • {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                    </div>

                                    <span style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        letterSpacing: '0.02em',
                                        padding: '4px 10px',
                                        borderRadius: '9999px',
                                        background: statusBadge.bg,
                                        color: statusBadge.color,
                                        border: `1px solid ${statusBadge.border}`,
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0
                                    }}>
                                        {statusBadge.label}
                                    </span>
                                </div>

                                {/* Subject Line Snippet */}
                                <div className="campaign-sub-box" style={{ marginBottom: '14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                        <Mail size={12} style={{ color: 'var(--text-dim)' }} />
                                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Subject</span>
                                    </div>
                                    <div style={{ 
                                        fontSize: '13px', 
                                        fontWeight: 500, 
                                        color: 'var(--text-primary)', 
                                        whiteSpace: 'nowrap', 
                                        overflow: 'hidden', 
                                        textOverflow: 'ellipsis' 
                                    }}>
                                        {c.subject}
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div style={{ marginBottom: '14px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '11.5px' }}>
                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                                            Delivery Progress
                                        </span>
                                        <span style={{ fontWeight: 700, color: c.status === 'completed' ? '#10b981' : 'var(--text-primary)' }}>
                                            {progressPercent}%
                                        </span>
                                    </div>
                                    <div style={{ 
                                        width: '100%', 
                                        height: '6px', 
                                        background: 'rgba(255, 255, 255, 0.08)', 
                                        borderRadius: '9999px', 
                                        overflow: 'hidden' 
                                    }}>
                                        <div style={{ 
                                            width: `${progressPercent}%`, 
                                            height: '100%', 
                                            background: c.status === 'completed' 
                                                ? '#10b981' 
                                                : c.status === 'sending' 
                                                    ? 'linear-gradient(90deg, #06b6d4, #3b82f6)' 
                                                    : 'var(--accent-color)', 
                                            borderRadius: '9999px',
                                            transition: 'width 0.3s ease'
                                        }} />
                                    </div>
                                </div>

                                {/* 3 Mini Metrics */}
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(3, 1fr)', 
                                    gap: '8px', 
                                    textAlign: 'center',
                                    marginBottom: '16px'
                                }}>
                                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '8px 4px', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Recipients</div>
                                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{c.totalRecipients || 0}</div>
                                    </div>
                                    <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', padding: '8px 4px', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '11px', color: '#10b981', marginBottom: '2px' }}>Delivered</div>
                                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#10b981' }}>{c.sentCount || 0}</div>
                                    </div>
                                    <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '8px 4px', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '11px', color: '#ef4444', marginBottom: '2px' }}>Failed</div>
                                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#ef4444' }}>{c.failedCount || 0}</div>
                                    </div>
                                </div>

                                {/* Footer & Action Buttons */}
                                <div style={{ 
                                    marginTop: 'auto', 
                                    paddingTop: '12px', 
                                    borderTop: '1px solid var(--border-color)', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    gap: '10px'
                                }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <ShieldCheck size={14} style={{ color: '#06b6d4' }} />
                                        <span>{c.mailboxesUsed?.length || 1} sender {c.mailboxesUsed?.length === 1 ? 'mailbox' : 'mailboxes'}</span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                                        <button 
                                            onClick={() => setDetailsCampaign(c)}
                                            className="btn-secondary"
                                            style={{ padding: '6px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                            title="View Details & Preview"
                                        >
                                            <Eye size={13} />
                                            <span>Details</span>
                                        </button>

                                        {deleteConfirmId === c._id ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <button 
                                                    onClick={(e) => handleDeleteCampaign(c._id, e)}
                                                    style={{ 
                                                        background: '#ef4444', 
                                                        color: '#fff', 
                                                        border: 'none', 
                                                        padding: '6px 9px', 
                                                        borderRadius: '6px', 
                                                        fontSize: '11px', 
                                                        fontWeight: 700,
                                                        cursor: 'pointer' 
                                                    }}
                                                >
                                                    Confirm
                                                </button>
                                                <button 
                                                    onClick={() => setDeleteConfirmId(null)}
                                                    style={{ 
                                                        background: 'transparent', 
                                                        border: '1px solid var(--border-color)', 
                                                        color: 'var(--text-secondary)', 
                                                        padding: '6px 8px', 
                                                        borderRadius: '6px', 
                                                        fontSize: '11px', 
                                                        cursor: 'pointer' 
                                                    }}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => setDeleteConfirmId(c._id)}
                                                className="btn-secondary"
                                                style={{ padding: '6px 8px', fontSize: '12px', color: 'var(--text-dim)' }}
                                                title="Delete Campaign"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* CREATE CAMPAIGN MODAL (FIXED HEADER & FOOTER ARCHITECTURE) */}
            {createModalOpen && createPortal(
                <div className="modal-overlay" onClick={() => !submitting && setCreateModalOpen(false)}>
                    <div 
                        className="glass-panel modal-card animate-modal-in" 
                        style={{ 
                            maxWidth: '820px', 
                            width: '95%',
                            height: '84vh', 
                            maxHeight: '700px',
                            display: 'flex', 
                            flexDirection: 'column', 
                            padding: 0, 
                            overflow: 'hidden' 
                        }} 
                        onClick={e => e.stopPropagation()}
                    >
                        {/* 1. FIXED MODAL HEADER (Never scrolls away) */}
                        <div className="modal-header-fixed">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 2px 0', color: 'var(--text-primary)' }}>
                                        Launch Cold Email Campaign
                                    </h2>
                                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                                        Targeting your eligible leads ({leadsCount} total in CRM)
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setCreateModalOpen(false)} 
                                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* 3 Step Tabs */}
                            <div style={{ 
                                display: 'flex', 
                                background: 'rgba(255, 255, 255, 0.04)', 
                                border: '1px solid var(--border-color)', 
                                borderRadius: '8px', 
                                padding: '3px' 
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setActiveStep(1)}
                                    style={{
                                        flex: 1,
                                        padding: '7px 10px',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '12.5px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        background: activeStep === 1 ? 'var(--accent-color)' : 'transparent',
                                        color: activeStep === 1 ? '#ffffff' : 'var(--text-secondary)',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <span>1. Senders & Setup</span>
                                    <span style={{ 
                                        fontSize: '11px', 
                                        padding: '1px 6px', 
                                        borderRadius: '9999px',
                                        background: activeStep === 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'
                                    }}>
                                        {selectedMailboxes.length}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveStep(2)}
                                    style={{
                                        flex: 1,
                                        padding: '7px 10px',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '12.5px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        background: activeStep === 2 ? 'var(--accent-color)' : 'transparent',
                                        color: activeStep === 2 ? '#ffffff' : 'var(--text-secondary)',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <span>2. Compose & AI Writer</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveStep(3)}
                                    style={{
                                        flex: 1,
                                        padding: '7px 10px',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '12.5px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        background: activeStep === 3 ? 'var(--accent-color)' : 'transparent',
                                        color: activeStep === 3 ? '#ffffff' : 'var(--text-secondary)',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <span>3. Live Preview</span>
                                </button>
                            </div>
                        </div>

                        {/* 2. SCROLLABLE MODAL BODY */}
                        <div className="modal-body-scroll">
                            {activeStep === 1 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                            Campaign Name
                                        </label>
                                        <input 
                                            type="text" 
                                            required 
                                            value={name} 
                                            onChange={e => setName(e.target.value)} 
                                            className="form-input" 
                                            placeholder="e.g. Q4 Executive Outreach"
                                        />
                                    </div>

                                    {/* Hostinger Sender Pool Manager */}
                                    <div style={{ 
                                        background: 'rgba(255, 255, 255, 0.02)', 
                                        border: '1px solid var(--border-color)', 
                                        borderRadius: '12px', 
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <ShieldCheck size={18} style={{ color: 'var(--accent-color)' }} />
                                                    <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                                                        Multi-Domain Round-Robin Sender Pool
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                    Selected: <strong>{selectedMailboxes.length} of {mailboxes.length} accounts</strong> • Daily delivery quota: <strong>{((selectedMailboxes.length * 500) || 0).toLocaleString()} emails/day</strong>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                <button 
                                                    type="button" 
                                                    onClick={selectAllMailboxes} 
                                                    style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 8px', color: 'var(--accent-color)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                                >
                                                    {selectedMailboxes.length === mailboxes.length ? 'Deselect All' : `Select All (${mailboxes.length})`}
                                                </button>
                                                {mailboxes.some(m => m.provider === 'cloudflare' || (m.emailUser && m.emailUser.endsWith('@untressed.com'))) && (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setSelectedMailboxes(mailboxes.filter(m => m.provider === 'cloudflare' || (m.emailUser && m.emailUser.endsWith('@untressed.com'))).map(m => m._id))} 
                                                        style={{ background: 'rgba(249, 115, 22, 0.15)', border: '1px solid rgba(249, 115, 22, 0.35)', borderRadius: '6px', padding: '4px 8px', color: '#fb923c', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                                    >
                                                        Cloudflare Aliases ({mailboxes.filter(m => m.provider === 'cloudflare' || (m.emailUser && m.emailUser.endsWith('@untressed.com'))).length})
                                                    </button>
                                                )}
                                                {mailboxes.some(m => m.provider === 'hostinger') && (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setSelectedMailboxes(mailboxes.filter(m => m.provider === 'hostinger').map(m => m._id))} 
                                                        style={{ background: 'rgba(124, 58, 237, 0.15)', border: '1px solid rgba(124, 58, 237, 0.35)', borderRadius: '6px', padding: '4px 8px', color: '#c4b5fd', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                                    >
                                                        Hostinger Inboxes ({mailboxes.filter(m => m.provider === 'hostinger').length})
                                                    </button>
                                                )}
                                                {mailboxes.length > 10 && (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setSelectedMailboxes(mailboxes.slice(0, 10).map(m => m._id))} 
                                                        style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 8px', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer' }}
                                                    >
                                                        First 10
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Search box */}
                                        <div style={{ position: 'relative', width: '100%' }}>
                                            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                                            <input 
                                                type="text" 
                                                value={mailboxSearch}
                                                onChange={e => setMailboxSearch(e.target.value)}
                                                placeholder={`Filter across ${mailboxes.length} active sender accounts and aliases...`}
                                                className="form-input"
                                                style={{ paddingLeft: '32px', paddingRight: '28px', fontSize: '12.5px', height: '36px' }}
                                            />
                                            {mailboxSearch && (
                                                <button 
                                                    type="button"
                                                    onClick={() => setMailboxSearch('')}
                                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>

                                        {/* 2-Column Responsive Grid */}
                                        <div style={{ 
                                            display: 'grid', 
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                                            gap: '6px', 
                                            maxHeight: '260px', 
                                            overflowY: 'auto', 
                                            padding: '4px 2px' 
                                        }}>
                                            {mailboxes
                                                .filter(mb => 
                                                    mb.emailUser?.toLowerCase().includes(mailboxSearch.toLowerCase()) ||
                                                    mb.senderName?.toLowerCase().includes(mailboxSearch.toLowerCase())
                                                )
                                                .map((mb) => {
                                                    const isSelected = selectedMailboxes.includes(mb._id);
                                                    const isCf = mb.provider === 'cloudflare' || (mb.emailUser && mb.emailUser.endsWith('@untressed.com'));
                                                    return (
                                                        <div 
                                                            key={mb._id} 
                                                            className={`mailbox-compact-row ${isSelected ? 'selected' : ''}`}
                                                            onClick={() => toggleMailboxSelection(mb._id)}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={isSelected} 
                                                                    onChange={() => {}} 
                                                                    style={{ cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                                                                />
                                                                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                                                    <div style={{ 
                                                                        fontWeight: 600, 
                                                                        fontSize: '12px', 
                                                                        color: 'var(--text-primary)', 
                                                                        whiteSpace: 'nowrap', 
                                                                        overflow: 'hidden', 
                                                                        textOverflow: 'ellipsis',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '6px'
                                                                    }}>
                                                                        <span>{mb.emailUser}</span>
                                                                        <span style={{
                                                                            fontSize: '9px',
                                                                            fontWeight: 700,
                                                                            padding: '1px 5px',
                                                                            borderRadius: '4px',
                                                                            background: isCf ? 'rgba(249, 115, 22, 0.15)' : 'rgba(124, 58, 237, 0.15)',
                                                                            color: isCf ? '#fb923c' : '#c4b5fd'
                                                                        }}>
                                                                            {isCf ? 'Cloudflare' : mb.provider}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                        {mb.senderName || 'Staff'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <span style={{ 
                                                                fontSize: '10.5px', 
                                                                fontWeight: 600, 
                                                                padding: '2px 6px', 
                                                                borderRadius: '4px', 
                                                                background: 'rgba(255, 255, 255, 0.05)', 
                                                                color: 'var(--text-secondary)',
                                                                whiteSpace: 'nowrap',
                                                                flexShrink: 0
                                                            }}>
                                                                {mb.dailyLimit || 500}/d
                                                            </span>
                                                        </div>
                                                    );
                                                })
                                            }
                                        </div>
                                    </div>

                                    {/* Audience Info */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-dim)' }}>
                                        <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                                        <span>Outreach batch will be dispatched to uncontacted leads assigned in your database.</span>
                                    </div>
                                </div>
                            )}

                            {activeStep === 2 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                    {/* AI Cold Email Copilot Box */}
                                    <div style={{ 
                                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(99, 102, 241, 0.04))', 
                                        border: '1px solid rgba(139, 92, 246, 0.25)', 
                                        borderRadius: '12px', 
                                        padding: '16px' 
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <Sparkles size={16} style={{ color: 'var(--accent-color)' }} />
                                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                AI Cold Email Writer
                                            </span>
                                        </div>

                                        {/* Quick Prompt Chips */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                                            {[
                                                'Follow-up for admissions & counseling',
                                                'Scholarship deadline alert',
                                                'Executive career upgrade pitch',
                                                '15-min discovery phone chat'
                                            ].map((chip) => (
                                                <button
                                                    key={chip}
                                                    type="button"
                                                    onClick={() => {
                                                        setAiPrompt(chip);
                                                        handleGenerateAi(chip);
                                                    }}
                                                    style={{
                                                        fontSize: '11px',
                                                        padding: '3px 9px',
                                                        borderRadius: '9999px',
                                                        border: '1px solid var(--border-color)',
                                                        background: 'rgba(255, 255, 255, 0.04)',
                                                        color: 'var(--text-secondary)',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    + {chip}
                                                </button>
                                            ))}
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input 
                                                type="text" 
                                                value={aiPrompt} 
                                                onChange={e => setAiPrompt(e.target.value)} 
                                                placeholder="e.g. Friendly admissions reminder with scholarship incentive..." 
                                                className="form-input" 
                                                style={{ fontSize: '13px', height: '40px' }}
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => handleGenerateAi()} 
                                                disabled={generatingAi}
                                                className="btn-secondary" 
                                                style={{ whiteSpace: 'nowrap', fontSize: '13px', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                            >
                                                {generatingAi ? (
                                                    <>
                                                        <RefreshCw size={14} className="animate-spin" />
                                                        <span>Writing...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles size={14} style={{ color: 'var(--accent-color)' }} />
                                                        <span>Generate</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Subject Line */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                            Subject Line
                                        </label>
                                        <input 
                                            type="text" 
                                            required 
                                            value={subject} 
                                            onChange={e => setSubject(e.target.value)} 
                                            className="form-input" 
                                            placeholder="e.g. Quick question regarding your upcoming goals, {{firstName}}"
                                        />
                                    </div>

                                    {/* Email Body & Variables */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                                            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                Email Body (HTML / Rich Text)
                                            </label>
                                            
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Insert tag:</span>
                                                {['{{firstName}}', '{{name}}', '{{course}}', '{{city}}', '{{email}}', '{{phone}}'].map((tag) => (
                                                    <button
                                                        key={tag}
                                                        type="button"
                                                        onClick={() => insertVariable(tag)}
                                                        className="campaign-var-chip"
                                                        title={`Insert ${tag}`}
                                                    >
                                                        {tag}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <textarea 
                                            ref={textareaRef}
                                            rows={8} 
                                            required 
                                            value={bodyHtml} 
                                            onChange={e => setBodyHtml(e.target.value)} 
                                            className="form-input" 
                                            style={{ fontFamily: 'monospace', fontSize: '12.5px', lineHeight: 1.55 }}
                                        />
                                    </div>
                                </div>
                            )}

                            {activeStep === 3 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ 
                                        background: 'rgba(255, 255, 255, 0.02)', 
                                        border: '1px solid var(--border-color)', 
                                        borderRadius: '12px', 
                                        overflow: 'hidden' 
                                    }}>
                                        {/* Preview Header / Metadata */}
                                        <div style={{ 
                                            background: 'rgba(255, 255, 255, 0.04)', 
                                            padding: '14px 18px', 
                                            borderBottom: '1px solid var(--border-color)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px'
                                        }}>
                                            <div style={{ display: 'flex', fontSize: '12.5px' }}>
                                                <span style={{ color: 'var(--text-dim)', width: '70px' }}>From:</span>
                                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    {mailboxes[0]?.senderName || 'Admissions Counselor'} &lt;{mailboxes[0]?.emailUser || 'counselor@domain.com'}&gt;
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', fontSize: '12.5px' }}>
                                                <span style={{ color: 'var(--text-dim)', width: '70px' }}>To:</span>
                                                <span style={{ color: 'var(--text-secondary)' }}>
                                                    Alex Rivera &lt;alex.rivera@example.com&gt;
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', fontSize: '12.5px' }}>
                                                <span style={{ color: 'var(--text-dim)', width: '70px' }}>Subject:</span>
                                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                                    {renderPreviewHtml(subject) || 'No subject'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Rendered HTML Content */}
                                        <div 
                                            style={{ 
                                                padding: '24px 20px', 
                                                fontSize: '14px', 
                                                lineHeight: 1.6, 
                                                color: 'var(--text-primary)',
                                                minHeight: '200px',
                                                background: 'var(--bg-secondary)'
                                            }}
                                            dangerouslySetInnerHTML={{ __html: renderPreviewHtml(bodyHtml) }}
                                        />
                                    </div>

                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '8px', 
                                        fontSize: '12px', 
                                        color: 'var(--text-dim)' 
                                    }}>
                                        <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                                        <span>Variables populated with sample lead: Alex Rivera (Course: Executive Leadership, City: New York).</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 3. FIXED MODAL FOOTER */}
                        <div className="modal-footer-fixed">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                <ShieldCheck size={16} style={{ color: 'var(--accent-color)' }} />
                                <span><strong>{selectedMailboxes.length}</strong> senders selected (~{((selectedMailboxes.length * 500) || 0).toLocaleString()} emails/day)</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setCreateModalOpen(false)} 
                                    className="btn-secondary" 
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>

                                {activeStep === 1 && (
                                    <button 
                                        type="button" 
                                        onClick={() => setActiveStep(2)} 
                                        className="btn-primary"
                                        disabled={selectedMailboxes.length === 0}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <span>Next: Compose Email</span>
                                        <ArrowRight size={14} />
                                    </button>
                                )}

                                {activeStep === 2 && (
                                    <>
                                        <button 
                                            type="button" 
                                            onClick={() => setActiveStep(1)} 
                                            className="btn-secondary"
                                        >
                                            ← Senders
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setActiveStep(3)} 
                                            className="btn-secondary"
                                        >
                                            Preview
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={handleCreateCampaign} 
                                            className="btn-primary"
                                            disabled={submitting || selectedMailboxes.length === 0}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <Send size={15} />
                                            <span>{submitting ? 'Launching...' : 'Launch Campaign'}</span>
                                        </button>
                                    </>
                                )}

                                {activeStep === 3 && (
                                    <>
                                        <button 
                                            type="button" 
                                            onClick={() => setActiveStep(2)} 
                                            className="btn-secondary"
                                        >
                                            ← Edit Message
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={handleCreateCampaign} 
                                            className="btn-primary"
                                            disabled={submitting || selectedMailboxes.length === 0}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <Send size={15} />
                                            <span>{submitting ? 'Launching...' : 'Launch Campaign'}</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* CAMPAIGN DETAILS & PREVIEW MODAL */}
            {detailsCampaign && createPortal(
                <div className="modal-overlay" onClick={() => setDetailsCampaign(null)}>
                    <div 
                        className="glass-panel modal-card animate-modal-in" 
                        style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }} 
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                                        {detailsCampaign.name}
                                    </h2>
                                    <span style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        padding: '3px 8px',
                                        borderRadius: '9999px',
                                        ...getStatusBadgeStyle(detailsCampaign.status)
                                    }}>
                                        {detailsCampaign.status}
                                    </span>
                                </div>
                                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>
                                    Created on {new Date(detailsCampaign.createdAt).toLocaleString()} by {detailsCampaign.createdBy?.name || 'Staff'}
                                </p>
                            </div>
                            <button 
                                onClick={() => setDetailsCampaign(null)} 
                                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Stats Summary Row */}
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(3, 1fr)', 
                            gap: '12px', 
                            marginBottom: '20px' 
                        }}>
                            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Recipients</div>
                                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{detailsCampaign.totalRecipients || 0}</div>
                            </div>
                            <div style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '11.5px', color: '#10b981', marginBottom: '4px' }}>Delivered</div>
                                <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981' }}>{detailsCampaign.sentCount || 0}</div>
                            </div>
                            <div style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '11.5px', color: '#ef4444', marginBottom: '4px' }}>Failed</div>
                                <div style={{ fontSize: '20px', fontWeight: 800, color: '#ef4444' }}>{detailsCampaign.failedCount || 0}</div>
                            </div>
                        </div>

                        {/* Subject & Rendered Email Box */}
                        <div style={{ 
                            background: 'rgba(255, 255, 255, 0.02)', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '10px', 
                            overflow: 'hidden', 
                            marginBottom: '20px' 
                        }}>
                            <div style={{ 
                                padding: '12px 16px', 
                                background: 'rgba(255, 255, 255, 0.04)', 
                                borderBottom: '1px solid var(--border-color)',
                                fontSize: '13px'
                            }}>
                                <span style={{ color: 'var(--text-dim)', marginRight: '8px' }}>Subject:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>{detailsCampaign.subject}</strong>
                            </div>
                            <div 
                                style={{ 
                                    padding: '18px 16px', 
                                    fontSize: '13.5px', 
                                    lineHeight: 1.6, 
                                    color: 'var(--text-primary)',
                                    maxHeight: '260px',
                                    overflowY: 'auto'
                                }}
                                dangerouslySetInnerHTML={{ __html: detailsCampaign.bodyHtml }}
                            />
                        </div>

                        {/* Mailboxes rotated */}
                        {detailsCampaign.mailboxesUsed?.length > 0 && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    Sender Accounts Used in Rotation ({detailsCampaign.mailboxesUsed.length})
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '130px', overflowY: 'auto', padding: '4px 0' }}>
                                    {detailsCampaign.mailboxesUsed.map((mb, idx) => (
                                        <span key={idx} style={{ 
                                            display: 'inline-flex', 
                                            alignItems: 'center', 
                                            gap: '6px', 
                                            fontSize: '12px', 
                                            padding: '4px 10px', 
                                            borderRadius: '6px', 
                                            background: 'rgba(255, 255, 255, 0.04)', 
                                            border: '1px solid var(--border-color)',
                                            color: 'var(--text-primary)'
                                        }}>
                                            <Mail size={12} style={{ color: 'var(--accent-color)' }} />
                                            <span>{mb.emailUser || mb}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Footer Actions */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                            <button 
                                onClick={(e) => handleDeleteCampaign(detailsCampaign._id, e)}
                                style={{ 
                                    background: 'none', 
                                    border: '1px solid rgba(239, 68, 68, 0.3)', 
                                    color: '#ef4444', 
                                    padding: '8px 14px', 
                                    borderRadius: '8px', 
                                    fontSize: '12.5px', 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '6px',
                                    cursor: 'pointer' 
                                }}
                            >
                                <Trash2 size={14} />
                                <span>Delete Campaign</span>
                            </button>

                            <button 
                                onClick={() => setDetailsCampaign(null)} 
                                className="btn-secondary"
                                style={{ padding: '8px 18px', fontSize: '13px' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default CampaignManager;
