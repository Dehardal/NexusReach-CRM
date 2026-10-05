import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Send, Plus, Sparkles, CheckCircle2, Clock, Users, Mail, AlertCircle, ArrowRight } from 'lucide-react';

const CampaignManager = () => {
    const { api, socket, user } = useAuth();
    const [campaigns, setCampaigns] = useState([]);
    const [mailboxes, setMailboxes] = useState([]);
    const [leadsCount, setLeadsCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);

    // Form inputs
    const [name, setName] = useState('');
    const [subject, setSubject] = useState('');
    const [bodyHtml, setBodyHtml] = useState('');
    const [selectedMailboxes, setSelectedMailboxes] = useState([]);
    const [aiPrompt, setAiPrompt] = useState('');
    const [generatingAi, setGeneratingAi] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [activeProgress, setActiveProgress] = useState(null);

    const fetchData = async () => {
        try {
            const [cRes, mRes, lRes] = await Promise.all([
                api.get('/campaigns'),
                api.get('/mailboxes'),
                api.get('/leads?limit=1')
            ]);
            setCampaigns(cRes.data);
            setMailboxes(mRes.data.filter(m => m.status === 'active'));
            setLeadsCount(lRes.data.total || 0);
        } catch (err) {
            console.error('[CAMPAIGN MANAGER] Error fetching data:', err);
        } finally {
            setLoading(false);
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
        setName(`Outreach Campaign #${campaigns.length + 1}`);
        setSubject('Quick question regarding your upcoming goals, {{firstName}}');
        setBodyHtml(`<p>Hi {{firstName}},</p>\n<p>I noticed your interest in our programs. We are opening enrollment for our next cohort and would love to share exclusive details and curriculum materials with you.</p>\n<p>Would you have 5 minutes for a quick chat this week?</p>\n<p>Best regards,<br/>Admissions Team</p>`);
        setSelectedMailboxes(mailboxes.map(m => m._id));
        setAiPrompt('');
        setModalOpen(true);
    };

    const handleGenerateAi = async () => {
        if (!aiPrompt.trim()) {
            alert('Please enter a brief topic or audience description for the AI.');
            return;
        }

        setGeneratingAi(true);
        try {
            // Using CRM AI prompt engine
            const { data } = await api.post('/scraper/generate-pitch', {
                companyName: 'Our Academy',
                services: aiPrompt,
                industry: 'Education & Admissions'
            }).catch(() => null) || {};

            if (data?.pitch) {
                setSubject(`Exciting opportunity for you, {{firstName}}`);
                setBodyHtml(`<p>Hi {{firstName}},</p>\n<p>${data.pitch.replace(/\n/g, '</p><p>')}</p>\n<p>Best regards,<br/>Admissions Department</p>`);
            } else {
                setSubject(`Invitation: Explore career advancement programs with us`);
                setBodyHtml(`<p>Hello {{firstName}},</p>\n<p>We are reaching out to prospective candidates interested in elevating their careers through our specialized programs in {{course}}.</p>\n<p>Our upcoming admissions round includes scholarship opportunities for eligible applicants.</p>\n<p>Reply to this email if you would like us to send the detailed prospectus.</p>\n<p>Warm regards,<br/>Admissions Office</p>`);
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

            setModalOpen(false);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Error launching campaign');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleMailboxSelection = (id) => {
        if (selectedMailboxes.includes(id)) {
            setSelectedMailboxes(selectedMailboxes.filter(m => m !== id));
        } else {
            setSelectedMailboxes([...selectedMailboxes, id]);
        }
    };

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '6px' }}>Email Marketing Campaigns</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Launch high-converting cold email sequences rotated automatically across your Hostinger sender pool.
                    </p>
                </div>
                <button 
                    onClick={openCreateModal} 
                    disabled={mailboxes.length === 0}
                    className="btn-primary" 
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Plus size={18} />
                    <span>Create Campaign</span>
                </button>
            </header>

            {/* Active Live Progress Bar if sending */}
            {activeProgress && activeProgress.percent < 100 && (
                <div className="glass-panel" style={{ padding: '20px', marginBottom: '28px', border: '1px solid rgba(6, 182, 212, 0.4)', background: 'rgba(6, 182, 212, 0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="animate-spin" style={{ color: '#06b6d4' }}>⚙️</span>
                            <span style={{ fontWeight: 700, fontSize: '14px', color: '#fff' }}>Campaign In Progress</span>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#06b6d4' }}>
                            {activeProgress.sentCount} / {activeProgress.totalRecipients} ({activeProgress.percent}%)
                        </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${activeProgress.percent}%`, height: '100%', background: '#06b6d4', transition: 'width 0.4s ease' }} />
                    </div>
                </div>
            )}

            {/* Campaign Summary & Guidance */}
            {mailboxes.length === 0 && (
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <AlertCircle size={20} style={{ color: '#f59e0b' }} />
                        <span style={{ fontSize: '13.5px', color: '#fbbf24' }}>
                            You have no active Hostinger mailboxes connected. Please add at least one Hostinger mailbox in <strong>Connected Mailboxes</strong> to begin sending.
                        </span>
                    </div>
                </div>
            )}

            {/* Campaigns Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>Loading campaigns...</div>
            ) : campaigns.length === 0 ? (
                <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <Send size={48} style={{ color: 'var(--text-dim)', marginBottom: '16px' }} />
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No Outreach Campaigns Yet</h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 auto 24px auto', fontSize: '14px' }}>
                        Create your first email marketing campaign to reach your assigned batch of leads across your Hostinger sender pool.
                    </p>
                    <button 
                        onClick={openCreateModal} 
                        disabled={mailboxes.length === 0}
                        className="btn-primary" 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Plus size={18} />
                        <span>Create Campaign</span>
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
                    {campaigns.map((c) => (
                        <div key={c._id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 4px 0' }}>{c.name}</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', margin: 0 }}>
                                        By <strong>{c.createdBy?.name || 'Staff'}</strong> • {new Date(c.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    padding: '3px 9px',
                                    borderRadius: '12px',
                                    background: c.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : c.status === 'sending' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255,255,255,0.08)',
                                    color: c.status === 'completed' ? '#10b981' : c.status === 'sending' ? '#06b6d4' : 'var(--text-secondary)'
                                }}>
                                    {c.status}
                                </span>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                                <p style={{ margin: '0 0 6px 0', color: 'var(--text-secondary)', fontSize: '11.5px' }}>Subject:</p>
                                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {c.subject}
                                </p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 6px', borderRadius: '8px' }}>
                                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px 0' }}>Recipients</p>
                                    <p style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>{c.totalRecipients || 0}</p>
                                </div>
                                <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '10px 6px', borderRadius: '8px' }}>
                                    <p style={{ fontSize: '11px', color: '#10b981', margin: '0 0 2px 0' }}>Delivered</p>
                                    <p style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#10b981' }}>{c.sentCount || 0}</p>
                                </div>
                                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '10px 6px', borderRadius: '8px' }}>
                                    <p style={{ fontSize: '11px', color: '#f87171', margin: '0 0 2px 0' }}>Failed</p>
                                    <p style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#f87171' }}>{c.failedCount || 0}</p>
                                </div>
                            </div>

                            <div style={{ marginTop: 'auto', paddingTop: '10px', fontSize: '12px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Mail size={13} />
                                <span>Sender pool: {c.mailboxesUsed?.length || 0} Hostinger mailboxes rotated</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Campaign Modal */}
            {modalOpen && (
                <div className="modal-overlay" onClick={() => !submitting && setModalOpen(false)}>
                    <div className="glass-panel modal-card animate-modal-in" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Launch Marketing Campaign</h2>
                                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                                    Targeting your assigned leads database ({leadsCount} leads total)
                                </p>
                            </div>
                            <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Campaign Name</label>
                                <input type="text" required value={name} onChange={e => setName(e.target.value)} className="form-input" />
                            </div>

                            {/* Mailbox Selector */}
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    Hostinger Sender Pool (Round-Robin Rotation)
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '140px', overflowY: 'auto', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                    {mailboxes.map((mb) => (
                                        <label key={mb._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedMailboxes.includes(mb._id)} 
                                                onChange={() => toggleMailboxSelection(mb._id)} 
                                            />
                                            <span style={{ fontWeight: 600 }}>{mb.emailUser}</span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>({mb.senderName} • limit {mb.dailyLimit}/day)</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* AI Copilot Prompt */}
                            <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '10px', padding: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <Sparkles size={16} style={{ color: '#a78bfa' }} />
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>AI Cold Email Writer</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input 
                                        type="text" 
                                        value={aiPrompt} 
                                        onChange={e => setAiPrompt(e.target.value)} 
                                        placeholder="e.g. Write a friendly follow-up for MBA/BBA admissions" 
                                        className="form-input" 
                                        style={{ fontSize: '12.5px' }}
                                    />
                                    <button 
                                        type="button" 
                                        onClick={handleGenerateAi} 
                                        disabled={generatingAi}
                                        className="btn-secondary" 
                                        style={{ whiteSpace: 'nowrap', fontSize: '12.5px', padding: '8px 14px' }}
                                    >
                                        {generatingAi ? 'Writing...' : 'Generate Pitch'}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                                    Subject Line
                                </label>
                                <input type="text" required value={subject} onChange={e => setSubject(e.target.value)} className="form-input" />
                            </div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Email Body (HTML/Text)</label>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button type="button" onClick={() => setBodyHtml(prev => prev + ' {{firstName}} ')} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: 'var(--accent-color)', fontSize: '11px', padding: '2px 6px', cursor: 'pointer' }}>+ {'{{firstName}}'}</button>
                                        <button type="button" onClick={() => setBodyHtml(prev => prev + ' {{course}} ')} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: 'var(--accent-color)', fontSize: '11px', padding: '2px 6px', cursor: 'pointer' }}>+ {'{{course}}'}</button>
                                        <button type="button" onClick={() => setBodyHtml(prev => prev + ' {{city}} ')} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: 'var(--accent-color)', fontSize: '11px', padding: '2px 6px', cursor: 'pointer' }}>+ {'{{city}}'}</button>
                                    </div>
                                </div>
                                <textarea 
                                    rows={8} 
                                    required 
                                    value={bodyHtml} 
                                    onChange={e => setBodyHtml(e.target.value)} 
                                    className="form-input" 
                                    style={{ fontFamily: 'monospace', fontSize: '12.5px', lineHeight: 1.5 }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary" disabled={submitting}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={submitting || selectedMailboxes.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Send size={15} />
                                    <span>{submitting ? 'Queuing Batch...' : 'Launch Campaign'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CampaignManager;
