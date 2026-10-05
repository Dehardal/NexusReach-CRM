import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Sparkles, Calendar, TrendingUp, DollarSign, Users, Award, Send, MessageSquare, Mail, Trash2 } from 'lucide-react';

const Dashboard = () => {
    const { api, user } = useAuth();
    const toast = useToast();
    const [stats, setStats] = useState({
        totalLeads: 0,
        hotLeads: 0,
        followupsToday: 0,
        conversionRate: 0,
        totalRevenue: 0,
        expectedRevenue: 0,
        whatsappSent: 0,
        whatsappReceived: 0,
        emailOutreachCount: 0
    });
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            const { data } = await api.get('/auth/stats/overview');
            setStats(data);
        } catch (err) {
            console.error('[DASHBOARD] Error loading stats:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [api]);

    const handleClearAllLeads = async () => {
        if (!window.confirm('Are you sure you want to delete ALL leads from the database? This action cannot be undone.')) {
            return;
        }
        try {
            const { data } = await api.delete('/leads/clear-all');
            toast.success(data.message);
            fetchStats();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to clear leads.');
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard analytics...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '6px' }}>Dashboard Overview</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Real-time business performance and AI intelligence metrics</p>
                </div>
                {user?.role === 'master' && (
                    <button onClick={handleClearAllLeads} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                        <Trash2 size={16} />
                        <span>Clear All Leads</span>
                    </button>
                )}
            </header>

            {/* Metrics Panel Grid */}
            <div className="stats-grid">
                <div className="glass-panel stat-card">
                    <div className="stat-header">
                        <span>Total Active Leads</span>
                        <Users size={20} style={{ color: '#60a5fa' }} />
                    </div>
                    <div className="stat-value">{stats.totalLeads}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Assigned lead catalog size</div>
                </div>

                <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--ai-hot)' }}>
                    <div className="stat-header">
                        <span>AI Hot Leads</span>
                        <Sparkles size={20} style={{ color: '#f87171' }} />
                    </div>
                    <div className="stat-value" style={{ color: '#f87171' }}>{stats.hotLeads}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Intelligently classified prospects</div>
                </div>

                <div className="glass-panel stat-card">
                    <div className="stat-header">
                        <span>Follow-ups Today</span>
                        <Calendar size={20} style={{ color: '#a78bfa' }} />
                    </div>
                    <div className="stat-value">{stats.followupsToday}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Reminders scheduled for today</div>
                </div>

                <div className="glass-panel stat-card">
                    <div className="stat-header">
                        <span>Lead Conversion</span>
                        <TrendingUp size={20} style={{ color: '#34d399' }} />
                    </div>
                    <div className="stat-value" style={{ color: '#34d399' }}>{stats.conversionRate}%</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Percentage of won/enrolled sales</div>
                </div>
            </div>

            {/* Financial Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', marginTop: '24px' }}>
                <div className="glass-panel" style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', color: '#34d399' }}>
                        <DollarSign size={36} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500, textTransform: 'uppercase' }}>Collected Revenue</p>
                        <h2 style={{ fontSize: '36px', fontWeight: 800, marginTop: '4px', fontFamily: 'var(--font-display)' }}>
                            ₹{stats.totalRevenue.toLocaleString('en-IN')}
                        </h2>
                    </div>
                </div>

                <div className="glass-panel" style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ padding: '16px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', color: '#818cf8' }}>
                        <Award size={36} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500, textTransform: 'uppercase' }}>Expected Revenue</p>
                        <h2 style={{ fontSize: '36px', fontWeight: 800, marginTop: '4px', fontFamily: 'var(--font-display)' }}>
                            ₹{stats.expectedRevenue.toLocaleString('en-IN')}
                        </h2>
                    </div>
                </div>
            </div>

            {/* Outreach Reporting section */}
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginTop: '44px', marginBottom: '16px' }}>Outreach & Communications Report</h2>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
                <div className="glass-panel stat-card" style={{ borderLeft: '3px solid #a78bfa' }}>
                    <div className="stat-header">
                        <span>WhatsApp Outreach Sent</span>
                        <Send size={18} style={{ color: '#a78bfa' }} />
                    </div>
                    <div className="stat-value" style={{ color: '#a78bfa' }}>{stats.whatsappSent}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Total client updates sent</div>
                </div>

                <div className="glass-panel stat-card" style={{ borderLeft: '3px solid #34d399' }}>
                    <div className="stat-header">
                        <span>WhatsApp Replies</span>
                        <MessageSquare size={18} style={{ color: '#34d399' }} />
                    </div>
                    <div className="stat-value" style={{ color: '#34d399' }}>{stats.whatsappReceived}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Customer messages received</div>
                </div>

                <div className="glass-panel stat-card" style={{ borderLeft: '3px solid #60a5fa' }}>
                    <div className="stat-header">
                        <span>Email Outreach Sent</span>
                        <Mail size={18} style={{ color: '#60a5fa' }} />
                    </div>
                    <div className="stat-value" style={{ color: '#60a5fa' }}>{stats.emailOutreachCount}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Outreach emails delivered</div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
