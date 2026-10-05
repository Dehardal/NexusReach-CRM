import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
    Mail, CheckCircle2, AlertTriangle, RefreshCw, Send, Lock, 
    HelpCircle, ShieldCheck, Users, Globe, ExternalLink, Key,
    Server, Info, Copy, Check
} from 'lucide-react';

const EmailSettings = () => {
    const { user, api } = useAuth();
    const toast = useToast();

    const isAdmin = ['master', 'admin', 'manager'].includes(user?.role);

    // Active tab: 'personal' | 'cloudflare' | 'team'
    const [activeTab, setActiveTab] = useState('personal');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    // Form inputs
    const [senderName, setSenderName] = useState('CRM Sales Team');
    const [emailUser, setEmailUser] = useState('');
    const [smtpUser, setSmtpUser] = useState('');
    const [emailPass, setEmailPass] = useState('');
    const [provider, setProvider] = useState('resend');
    const [smtpHost, setSmtpHost] = useState('smtp.resend.com');
    const [smtpPort, setSmtpPort] = useState(465);

    // Status
    const [isConfigured, setIsConfigured] = useState(false);
    const [hasPass, setHasPass] = useState(false);
    const [guideOpen, setGuideOpen] = useState(false);
    const [copiedWebhook, setCopiedWebhook] = useState(false);

    // Team status (for Admins)
    const [teamMailboxes, setTeamMailboxes] = useState([]);
    const [loadingTeam, setLoadingTeam] = useState(false);

    // Inbound Webhook URL (from Cloudflare Tunnel)
    const webhookUrl = 'https://upper-whole-charles-automation.trycloudflare.com/api/email/incoming-webhook';

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/email-settings');
            setIsConfigured(data.isConfigured);
            setSenderName(data.senderName || user?.name || 'CRM Sales Team');
            setEmailUser(data.emailUser || '');
            setSmtpUser(data.smtpUser || '');
            setProvider(data.provider || 'resend');
            setSmtpHost(data.smtpHost || (data.provider === 'resend' ? 'smtp.resend.com' : 'smtp.resend.com'));
            setSmtpPort(data.smtpPort || (data.provider === 'resend' ? 465 : 587));
            setHasPass(data.hasPass);
        } catch (err) {
            console.error('[EMAIL SETTINGS] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchTeamMailboxes = async () => {
        if (!isAdmin) return;
        setLoadingTeam(true);
        try {
            const { data } = await api.get('/email-settings/team');
            setTeamMailboxes(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('[EMAIL SETTINGS] Team fetch error:', err);
        } finally {
            setLoadingTeam(false);
        }
    };

    useEffect(() => {
        fetchSettings();
        if (isAdmin) {
            fetchTeamMailboxes();
        }
    }, [isAdmin]);

    // Handle provider preset selection
    const handleProviderChange = (newProvider) => {
        setProvider(newProvider);
        if (newProvider === 'resend') {
            setSmtpHost('smtp.resend.com');
            setSmtpPort(465);
            setSmtpUser('resend');
        } else if (newProvider === 'brevo') {
            setSmtpHost('smtp-relay.brevo.com');
            setSmtpPort(587);
            setSmtpUser(emailUser);
        } else if (newProvider === 'gmail') {
            setSmtpHost('smtp.gmail.com');
            setSmtpPort(587);
            setSmtpUser(emailUser);
        } else if (newProvider === 'outlook') {
            setSmtpHost('smtp.office365.com');
            setSmtpPort(587);
            setSmtpUser(emailUser);
        } else {
            setSmtpHost('smtp.yourdomain.com');
            setSmtpPort(587);
            setSmtpUser(emailUser);
        }
    };

    const handleSaveAndVerify = async (e) => {
        e?.preventDefault();
        if (!emailUser) {
            toast.error('Please enter your Email Address.');
            return;
        }

        if (!hasPass && !emailPass) {
            toast.error('Please enter your SMTP Password or API Key.');
            return;
        }

        setSaving(true);
        try {
            const { data } = await api.post('/email-settings', {
                senderName,
                emailUser,
                smtpUser: smtpUser || (provider === 'resend' ? 'resend' : emailUser),
                emailPass,
                provider,
                smtpHost,
                smtpPort: Number(smtpPort)
            });

            toast.success(data.message || 'Credentials encrypted with AES-256 and verified successfully!');
            setIsConfigured(true);
            setHasPass(true);
            setEmailPass('');
            if (isAdmin) fetchTeamMailboxes();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to authenticate email. Please verify credentials.');
        } finally {
            setSaving(false);
        }
    };

    const handleSendTestEmail = async () => {
        setTesting(true);
        try {
            const { data } = await api.post('/email-settings/test');
            toast.success(data.message || 'Test email dispatched successfully!');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to dispatch test email.');
        } finally {
            setTesting(false);
        }
    };

    const copyWebhook = () => {
        navigator.clipboard.writeText(webhookUrl);
        setCopiedWebhook(true);
        toast.success('Inbound Webhook URL copied to clipboard');
        setTimeout(() => setCopiedWebhook(false), 2000);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
                <RefreshCw size={28} className="spin" style={{ animation: 'spin 2s linear infinite', color: 'var(--accent-color)' }} />
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ maxWidth: '850px', margin: '0 auto', paddingBottom: '40px' }}>
            <header style={{ marginBottom: '28px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '30px', fontWeight: 800, marginBottom: '8px', background: 'linear-gradient(135deg, #fff 40%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Domain Email & Mailbox Settings
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '620px', margin: '0 auto' }}>
                    Connect your personalized custom domain address (e.g. <code>alex@untressed.com</code>) with AES-256 encrypted SMTP and Cloudflare Inbound Routing.
                </p>
            </header>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
                <button
                    onClick={() => setActiveTab('personal')}
                    style={{
                        padding: '12px 18px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'personal' ? '2px solid var(--accent-color)' : '2px solid transparent',
                        color: activeTab === 'personal' ? '#fff' : 'var(--text-secondary)',
                        fontWeight: activeTab === 'personal' ? 700 : 500,
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                    }}
                >
                    <Mail size={16} />
                    <span>My Outgoing SMTP</span>
                </button>

                <button
                    onClick={() => setActiveTab('cloudflare')}
                    style={{
                        padding: '12px 18px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'cloudflare' ? '2px solid var(--accent-color)' : '2px solid transparent',
                        color: activeTab === 'cloudflare' ? '#fff' : 'var(--text-secondary)',
                        fontWeight: activeTab === 'cloudflare' ? 700 : 500,
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                    }}
                >
                    <Globe size={16} />
                    <span>Inbound Cloudflare Routing</span>
                </button>

                {isAdmin && (
                    <button
                        onClick={() => setActiveTab('team')}
                        style={{
                            padding: '12px 18px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'team' ? '2px solid var(--accent-color)' : '2px solid transparent',
                            color: activeTab === 'team' ? '#fff' : 'var(--text-secondary)',
                            fontWeight: activeTab === 'team' ? 700 : 500,
                            fontSize: '14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Users size={16} />
                        <span>Team Mailboxes Audit</span>
                    </button>
                )}
            </div>

            {/* TAB 1: PERSONAL SMTP INTEGRATION */}
            {activeTab === 'personal' && (
                <div>
                    {/* Connection Status Card */}
                    <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: isConfigured ? '4px solid #10b981' : '4px solid #f87171' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: isConfigured ? 'rgba(16,185,129,0.12)' : 'rgba(248,113,113,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isConfigured ? '#10b981' : '#f87171' }}>
                                {isConfigured ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                            </div>
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                                    {isConfigured ? 'Personal Mailbox Connected' : 'Mailbox Not Configured'}
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    {isConfigured ? (
                                        <>Outbound address: <strong style={{ color: '#fff' }}>{emailUser}</strong> via <span style={{ textTransform: 'capitalize', color: 'var(--accent-color)' }}>{provider}</span> (Encrypted AES-256)</>
                                    ) : (
                                        'Configure your custom domain SMTP credentials to send client outreach and follow-ups.'
                                    )}
                                </p>
                            </div>
                        </div>

                        {isConfigured && (
                            <button onClick={handleSendTestEmail} disabled={testing} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', fontSize: '13px' }}>
                                <Send size={14} />
                                <span>{testing ? 'Sending...' : 'Send Test Email'}</span>
                            </button>
                        )}
                    </div>

                    {/* Security Notice */}
                    <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '12px', padding: '14px 18px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <ShieldCheck size={22} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            <strong style={{ color: '#fff' }}>Zero-Knowledge Credential Encryption:</strong> Your SMTP password or API key is encrypted using industry-standard <strong>AES-256-GCM</strong>. Passwords are never logged or exposed in client responses.
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSaveAndVerify} className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
                            <Server size={18} style={{ color: 'var(--accent-color)' }} />
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Outbound SMTP Configuration</span>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                Sender Name (Appears in Recipient's Inbox)
                            </label>
                            <input 
                                type="text" 
                                required 
                                value={senderName} 
                                onChange={e => setSenderName(e.target.value)} 
                                placeholder="e.g. Alex | Support Team" 
                                className="form-input" 
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    Outbound Provider
                                </label>
                                <select 
                                    value={provider} 
                                    onChange={e => handleProviderChange(e.target.value)} 
                                    className="form-input"
                                >
                                    <option value="resend">Resend (Free 3,000/mo - Recommended for Custom Domain)</option>
                                    <option value="brevo">Brevo / Sendinblue (Free 300/day)</option>
                                    <option value="custom">Custom Domain SMTP Server</option>
                                    <option value="gmail">Google Gmail / Workspace (App Password)</option>
                                    <option value="outlook">Microsoft Outlook / Office 365</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    Your Domain Email Address
                                </label>
                                <input 
                                    type="email" 
                                    required 
                                    value={emailUser} 
                                    onChange={e => setEmailUser(e.target.value)} 
                                    placeholder="e.g. alex@untressed.com" 
                                    className="form-input" 
                                />
                            </div>
                        </div>

                        {/* Provider-specific guidelines banner */}
                        {provider === 'resend' && (
                            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '12px 16px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                💡 <strong>Resend Free Tier:</strong> Go to <a href="https://resend.com" target="_blank" rel="noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>resend.com</a>, add domain <code>untressed.com</code>, generate an API key (starting with <code>re_...</code>), and paste it below. You get 3,000 free emails every month!
                            </div>
                        )}

                        {provider === 'brevo' && (
                            <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '10px', padding: '12px 16px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                💡 <strong>Brevo Free Tier:</strong> Go to <a href="https://brevo.com" target="_blank" rel="noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>brevo.com</a> &gt; SMTP & API &gt; generate an SMTP Master Key. Paste your Brevo account email in SMTP User and your Master Key below.
                            </div>
                        )}

                        {/* Password / API Key Input */}
                        <div>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                {provider === 'resend' ? 'Resend API Key (re_...)' : provider === 'gmail' ? '16-character Google App Password' : 'SMTP Password / API Key'} {hasPass && <span style={{ color: '#10b981', fontWeight: 400 }}>(Currently Saved & Encrypted)</span>}
                            </label>
                            <input 
                                type="password" 
                                required={!hasPass}
                                value={emailPass} 
                                onChange={e => setEmailPass(e.target.value)} 
                                placeholder={hasPass ? '••••••••••••••••••••••••••••••••' : (provider === 'resend' ? 're_123456789...' : 'Enter password or API key')} 
                                className="form-input" 
                            />
                        </div>

                        {/* Advanced SMTP Details for Custom or Brevo */}
                        {(provider === 'custom' || provider === 'brevo') && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                        SMTP Host
                                    </label>
                                    <input 
                                        type="text" 
                                        value={smtpHost} 
                                        onChange={e => setSmtpHost(e.target.value)} 
                                        placeholder="smtp.untressed.com" 
                                        className="form-input" 
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                        SMTP Port
                                    </label>
                                    <input 
                                        type="number" 
                                        value={smtpPort} 
                                        onChange={e => setSmtpPort(e.target.value)} 
                                        className="form-input" 
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                        Auth Username
                                    </label>
                                    <input 
                                        type="text" 
                                        value={smtpUser} 
                                        onChange={e => setSmtpUser(e.target.value)} 
                                        placeholder={emailUser || 'Username'} 
                                        className="form-input" 
                                    />
                                </div>
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={saving} 
                            className="btn-primary" 
                            style={{ padding: '14px', fontSize: '14px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            {saving ? (
                                <>
                                    <RefreshCw size={16} className="spin" style={{ animation: 'spin 2s linear infinite' }} />
                                    <span>Verifying Credentials with SMTP Server...</span>
                                </>
                            ) : (
                                <>
                                    <Lock size={16} />
                                    <span>Encrypt & Save Connection</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>
            )}

            {/* TAB 2: CLOUDFLARE INBOUND ROUTING SETUP */}
            {activeTab === 'cloudflare' && (
                <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                        <Globe size={22} style={{ color: 'var(--accent-color)' }} />
                        <div>
                            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>Cloudflare Free Inbound Email Architecture</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>How your custom domain receives emails without any paid email hosting</p>
                        </div>
                    </div>

                    {/* How It Works Diagram */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', textAlign: 'center', position: 'relative' }}>
                            <div style={{ background: 'rgba(99,102,241,0.1)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.2)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--accent-color)', fontWeight: 700 }}>STEP 1</div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginTop: '4px' }}>Client Sends Mail</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>To user@untressed.com</div>
                            </div>
                            <div style={{ background: 'rgba(245,158,11,0.1)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)' }}>
                                <div style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 700 }}>STEP 2</div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginTop: '4px' }}>Cloudflare Routing</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Routes to Worker</div>
                            </div>
                            <div style={{ background: 'rgba(16,185,129,0.1)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)' }}>
                                <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>STEP 3</div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginTop: '4px' }}>Cloudflare Worker</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>POST to Webhook</div>
                            </div>
                            <div style={{ background: 'rgba(139,92,246,0.1)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.2)' }}>
                                <div style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 700 }}>STEP 4</div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginTop: '4px' }}>CRM Inbox</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Assigned to User</div>
                            </div>
                        </div>
                    </div>

                    {/* Active Webhook URL */}
                    <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Your Live Inbound Webhook Endpoint
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                                type="text" 
                                readOnly 
                                value={webhookUrl} 
                                className="form-input" 
                                style={{ fontFamily: 'monospace', fontSize: '12.5px', color: '#a78bfa' }} 
                            />
                            <button 
                                onClick={copyWebhook} 
                                className="btn-secondary" 
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                            >
                                {copiedWebhook ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                                <span>{copiedWebhook ? 'Copied' : 'Copy'}</span>
                            </button>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                            This URL is automatically bridged to your local backend via the secure Cloudflare Tunnel daemon.
                        </p>
                    </div>

                    {/* Cloudflare Worker Code Snippet */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                Cloudflare Email Worker Code (<code>email-worker.js</code>)
                            </label>
                            <a 
                                href="https://dash.cloudflare.com" 
                                target="_blank" 
                                rel="noreferrer" 
                                style={{ fontSize: '12px', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <span>Open Cloudflare Dashboard</span>
                                <ExternalLink size={12} />
                            </a>
                        </div>
                        <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace', color: '#e2e8f0', overflowX: 'auto', border: '1px solid var(--border-color)', lineHeight: 1.5 }}>
{`export default {
  async email(message, env, ctx) {
    const rawEmail = await new Response(message.raw).text();
    const payload = {
      from: message.from,
      to: message.to,
      subject: message.headers.get("subject") || "(No Subject)",
      raw: rawEmail
    };

    await fetch("${webhookUrl}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }
};`}
                        </pre>
                    </div>
                </div>
            )}

            {/* TAB 3: ADMIN TEAM MAILBOXES AUDIT */}
            {activeTab === 'team' && isAdmin && (
                <div className="glass-panel" style={{ padding: '28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Team Mailbox Deployment Status</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                Monitor domain email configurations and outbound security across all CRM users
                            </p>
                        </div>
                        <button 
                            onClick={fetchTeamMailboxes} 
                            disabled={loadingTeam} 
                            className="btn-secondary" 
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px' }}
                        >
                            <RefreshCw size={14} className={loadingTeam ? 'spin' : ''} style={loadingTeam ? { animation: 'spin 2s linear infinite' } : {}} />
                            <span>Refresh</span>
                        </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                                    <th style={{ padding: '12px 10px' }}>User</th>
                                    <th style={{ padding: '12px 10px' }}>Role</th>
                                    <th style={{ padding: '12px 10px' }}>Domain Mailbox</th>
                                    <th style={{ padding: '12px 10px' }}>Provider</th>
                                    <th style={{ padding: '12px 10px' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {teamMailboxes.map(member => (
                                    <tr key={member.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '14px 10px' }}>
                                            <div style={{ fontWeight: 600, color: '#fff' }}>{member.name}</div>
                                            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{member.loginEmail}</div>
                                        </td>
                                        <td style={{ padding: '14px 10px' }}>
                                            <span style={{ 
                                                textTransform: 'uppercase', 
                                                fontSize: '10.5px', 
                                                fontWeight: 700, 
                                                padding: '3px 8px', 
                                                borderRadius: '6px',
                                                background: member.role === 'master' ? 'rgba(239, 68, 68, 0.15)' : member.role === 'admin' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                                                color: member.role === 'master' ? '#f87171' : member.role === 'admin' ? '#818cf8' : '#cbd5e1'
                                            }}>
                                                {member.role}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 10px', fontFamily: member.domainEmail !== 'Not Configured' ? 'monospace' : 'inherit', color: member.domainEmail !== 'Not Configured' ? '#a78bfa' : 'var(--text-secondary)' }}>
                                            {member.domainEmail}
                                        </td>
                                        <td style={{ padding: '14px 10px', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                                            {member.provider}
                                        </td>
                                        <td style={{ padding: '14px 10px' }}>
                                            {member.isConfigured ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#10b981', fontWeight: 600, fontSize: '12px' }}>
                                                    <CheckCircle2 size={14} /> Active
                                                </span>
                                            ) : (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#f87171', fontSize: '12px' }}>
                                                    <AlertTriangle size={14} /> Inactive
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmailSettings;
