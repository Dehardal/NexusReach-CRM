import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
    Mail, CheckCircle2, AlertTriangle, RefreshCw, Send, Lock, 
    HelpCircle, ShieldCheck, Users, Globe, ExternalLink, Key,
    Server, Info, Copy, Check, Eye, EyeOff, Cpu, Layers, UploadCloud,
    FileSpreadsheet, ArrowRight, Sparkles
} from 'lucide-react';
import CustomDropdown from '../components/CustomDropdown';

const EmailSettings = () => {
    const { user, api } = useAuth();
    const toast = useToast();

    const isAdmin = ['master', 'admin', 'manager'].includes(user?.role);

    // Active tab: 'google' | 'hostinger' | 'cloudflare' | 'custom' | 'team'
    const [activeTab, setActiveTab] = useState('google');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    // Google / Outbound Form inputs
    const [senderName, setSenderName] = useState('CRM Sales Team');
    const [emailUser, setEmailUser] = useState('');
    const [smtpUser, setSmtpUser] = useState('');
    const [emailPass, setEmailPass] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [provider, setProvider] = useState('gmail');
    const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
    const [smtpPort, setSmtpPort] = useState(587);

    // Status
    const [isConfigured, setIsConfigured] = useState(false);
    const [hasPass, setHasPass] = useState(false);
    const [guideOpen, setGuideOpen] = useState(false);
    const [copiedWebhook, setCopiedWebhook] = useState(false);

    // Domain Aliases Sync State
    const [aliasesText, setAliasesText] = useState('');
    const [syncingAliases, setSyncingAliases] = useState(false);
    const [aliasSyncResult, setAliasSyncResult] = useState(null);

    // Hostinger Agentic Mail API Integration State
    const [hostingerStatus, setHostingerStatus] = useState({ configured: false, maskedKey: '', domain: 'risegrowthgroup.com' });
    const [hostingerTokenInput, setHostingerTokenInput] = useState('');
    const [savingHostingerToken, setSavingHostingerToken] = useState(false);
    const [syncingHostinger, setSyncingHostinger] = useState(false);
    const [hostingerBanner, setHostingerBanner] = useState(null);

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
            setProvider(data.provider || 'gmail');
            setSmtpHost(data.smtpHost || (data.provider === 'gmail' ? 'smtp.gmail.com' : 'smtp.resend.com'));
            setSmtpPort(data.smtpPort || (data.provider === 'gmail' ? 587 : 465));
            setHasPass(data.hasPass);
        } catch (err) {
            console.error('[EMAIL SETTINGS] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchHostingerStatus = async () => {
        try {
            const { data } = await api.get('/mailboxes/hostinger-api-status');
            setHostingerStatus(data);
        } catch (err) {
            console.warn('[HOSTINGER API STATUS WARNING]', err.message);
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
        fetchHostingerStatus();
        if (isAdmin) {
            fetchTeamMailboxes();
        }
    }, [isAdmin]);

    // Save & Verify Outbound SMTP
    const handleSaveAndVerify = async (e, customProvider = null) => {
        e?.preventDefault();
        const activeProvider = customProvider || provider;

        if (!emailUser) {
            toast.error('Please enter your Email Address.');
            return;
        }

        if (!hasPass && !emailPass) {
            toast.error('Please enter your SMTP Password or App Password.');
            return;
        }

        setSaving(true);
        try {
            const { data } = await api.post('/email-settings', {
                senderName,
                emailUser,
                smtpUser: smtpUser || (activeProvider === 'resend' ? 'resend' : emailUser),
                emailPass,
                provider: activeProvider,
                smtpHost,
                smtpPort: Number(smtpPort)
            });

            toast.success(data.message || 'Credentials encrypted and synced to Mailbox Hub!');
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

    // Bulk Sync Domain Aliases to Mailbox Hub
    const handleSyncAliases = async () => {
        if (!aliasesText.trim()) {
            toast.error('Please enter or paste your domain email addresses.');
            return;
        }

        setSyncingAliases(true);
        setAliasSyncResult(null);
        try {
            const { data } = await api.post('/email-settings/sync-aliases', {
                aliasesText: aliasesText.trim()
            });
            setAliasSyncResult({ type: 'success', message: data.message, stats: data.stats });
            toast.success(data.message);
            setAliasesText('');
        } catch (err) {
            setAliasSyncResult({
                type: 'error',
                message: err.response?.data?.message || 'Failed to sync domain aliases'
            });
            toast.error(err.response?.data?.message || 'Failed to sync domain aliases');
        } finally {
            setSyncingAliases(false);
        }
    };

    // Save Hostinger API Key
    const handleSaveHostingerKey = async (e) => {
        if (e) e.preventDefault();
        if (!hostingerTokenInput.trim()) return;

        setSavingHostingerToken(true);
        setHostingerBanner(null);
        try {
            const { data } = await api.post('/mailboxes/save-api-key', { 
                apiKey: hostingerTokenInput.trim()
            });
            setHostingerBanner({ type: data.verified ? 'success' : 'warning', text: data.message });
            setHostingerTokenInput('');
            fetchHostingerStatus();
            toast.success(data.message);
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to save Hostinger API token';
            setHostingerBanner({ type: 'error', text: msg });
            toast.error(msg);
        } finally {
            setSavingHostingerToken(false);
        }
    };

    // Sync Hostinger Inboxes via API
    const handleSyncHostingerApi = async () => {
        setSyncingHostinger(true);
        setHostingerBanner(null);
        try {
            const { data } = await api.post('/mailboxes/sync-hostinger-api', { defaultLimit: 500 });
            setHostingerBanner({ type: 'success', text: data.message });
            toast.success(data.message);
            fetchHostingerStatus();
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Hostinger API sync failed';
            setHostingerBanner({ type: 'error', text: msg });
            toast.error(msg);
        } finally {
            setSyncingHostinger(false);
        }
    };

    // Send Test Email
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
        <div className="animate-fade-in" style={{ maxWidth: '960px', margin: '0 auto', paddingBottom: '50px' }}>
            <header style={{ marginBottom: '28px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '8px', background: 'linear-gradient(135deg, #fff 40%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Email Settings & Provider Integrations
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', maxWidth: '680px', margin: '0 auto' }}>
                    The central command hub to authenticate and connect all outbound email accounts, Hostinger APIs, Cloudflare aliases, and SMTP relays.
                </p>
            </header>

            {/* Navigation Tabs */}
            <div style={{ 
                display: 'flex', 
                gap: '6px', 
                borderBottom: '1px solid var(--border-color)', 
                marginBottom: '26px',
                overflowX: 'auto',
                paddingBottom: '2px'
            }}>
                <button
                    onClick={() => setActiveTab('google')}
                    style={{
                        padding: '12px 18px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'google' ? '2px solid var(--accent-color)' : '2px solid transparent',
                        color: activeTab === 'google' ? '#fff' : 'var(--text-secondary)',
                        fontWeight: activeTab === 'google' ? 700 : 500,
                        fontSize: '13.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        whiteSpace: 'nowrap'
                    }}
                >
                    <Mail size={16} />
                    <span>Google & Cloudflare Aliases</span>
                </button>

                <button
                    onClick={() => setActiveTab('hostinger')}
                    style={{
                        padding: '12px 18px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'hostinger' ? '2px solid var(--accent-color)' : '2px solid transparent',
                        color: activeTab === 'hostinger' ? '#fff' : 'var(--text-secondary)',
                        fontWeight: activeTab === 'hostinger' ? 700 : 500,
                        fontSize: '13.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        whiteSpace: 'nowrap'
                    }}
                >
                    <Cpu size={16} />
                    <span>Hostinger Agentic Mail API</span>
                    {hostingerStatus.configured && (
                        <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '2px 6px', borderRadius: '4px' }}>Active</span>
                    )}
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
                        fontSize: '13.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        whiteSpace: 'nowrap'
                    }}
                >
                    <Globe size={16} />
                    <span>Inbound Cloudflare Routing</span>
                </button>

                <button
                    onClick={() => setActiveTab('custom')}
                    style={{
                        padding: '12px 18px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'custom' ? '2px solid var(--accent-color)' : '2px solid transparent',
                        color: activeTab === 'custom' ? '#fff' : 'var(--text-secondary)',
                        fontWeight: activeTab === 'custom' ? 700 : 500,
                        fontSize: '13.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        whiteSpace: 'nowrap'
                    }}
                >
                    <Server size={16} />
                    <span>Custom SMTP / Brevo / Resend</span>
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
                            fontSize: '13.5px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <Users size={16} />
                        <span>Team Mailboxes Audit</span>
                    </button>
                )}
            </div>

            {/* ========================================== */}
            {/* TAB 1: GOOGLE & CLOUDFLARE ALIASES */}
            {/* ========================================== */}
            {activeTab === 'google' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Status Card */}
                    <div className="glass-panel" style={{ padding: '22px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: (isConfigured && provider === 'gmail') ? '4px solid #10b981' : '4px solid #f87171' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: (isConfigured && provider === 'gmail') ? 'rgba(16,185,129,0.12)' : 'rgba(248,113,113,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: (isConfigured && provider === 'gmail') ? '#10b981' : '#f87171' }}>
                                {(isConfigured && provider === 'gmail') ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                            </div>
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: 0 }}>
                                    {(isConfigured && provider === 'gmail') ? 'Google SMTP Dispatch Engine Connected' : 'Google SMTP Not Configured'}
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                                    {(isConfigured && provider === 'gmail') ? (
                                        <>Authenticated Master Sender: <strong style={{ color: '#fff' }}>{emailUser}</strong>. All Cloudflare aliases dispatch through this connection.</>
                                    ) : (
                                        'Connect your Google Account with a 16-character App Password to send emails as your domain aliases.'
                                    )}
                                </p>
                            </div>
                        </div>

                        {isConfigured && provider === 'gmail' && (
                            <button onClick={handleSendTestEmail} disabled={testing} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', fontSize: '13px' }}>
                                <Send size={14} />
                                <span>{testing ? 'Sending...' : 'Send Test Email'}</span>
                            </button>
                        )}
                    </div>

                    {/* Step 1: Google SMTP Authentication */}
                    <form onSubmit={(e) => { setProvider('gmail'); setSmtpHost('smtp.gmail.com'); setSmtpPort(587); handleSaveAndVerify(e, 'gmail'); }} className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                            <Key size={18} style={{ color: 'var(--accent-color)' }} />
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Step 1: Authenticate Google SMTP Account</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    Sender Display Name
                                </label>
                                <input 
                                    type="text" 
                                    required 
                                    value={senderName} 
                                    onChange={e => setSenderName(e.target.value)} 
                                    placeholder="e.g. Master Architect" 
                                    className="form-input" 
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    Primary Google Account Email
                                </label>
                                <input 
                                    type="email" 
                                    required 
                                    value={emailUser} 
                                    onChange={e => setEmailUser(e.target.value)} 
                                    placeholder="e.g. growth.untressed@gmail.com" 
                                    className="form-input" 
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                16-character Google App Password {hasPass && <span style={{ color: '#10b981', fontWeight: 400 }}>(Currently Saved & Encrypted)</span>}
                            </label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    required={!hasPass}
                                    value={emailPass} 
                                    onChange={e => setEmailPass(e.target.value)} 
                                    placeholder={hasPass ? '••••••••••••••••••••••••••••••••' : 'Enter 16-character App Password (e.g. abcd efgh ijkl mnop)'} 
                                    className="form-input" 
                                    style={{ paddingRight: '42px', width: '100%', fontFamily: 'monospace' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: showPassword ? 'var(--accent-color)' : 'var(--text-dim)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '4px'
                                    }}
                                    title={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                </button>
                            </div>
                            <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#a78bfa' }}>
                                💡 Generate a 16-character password at: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: '#c4b5fd', textDecoration: 'underline' }}>myaccount.google.com/apppasswords</a>
                            </p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                            <button type="submit" disabled={saving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}>
                                <Lock size={15} />
                                <span>{saving ? 'Verifying with Google...' : 'Encrypt & Save Google Connection'}</span>
                            </button>
                        </div>
                    </form>

                    {/* Step 2: Bulk Sync Cloudflare / Domain Aliases */}
                    <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Layers size={18} style={{ color: 'var(--accent-color)' }} />
                                <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Step 2: Sync Your Domain Aliases into Mailbox Hub</span>
                            </div>
                            <span style={{ fontSize: '12px', background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd', padding: '4px 10px', borderRadius: '6px' }}>
                                Cloudflare Email Routing
                            </span>
                        </div>

                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                            Paste your list of domain emails below (or paste from <code>untressed_emails.csv</code>). 
                            These will be automatically created in the <strong>Mailbox Hub</strong> so you can rotate them in campaigns and select them in your inbox!
                        </p>

                        <textarea
                            rows="6"
                            value={aliasesText}
                            onChange={(e) => setAliasesText(e.target.value)}
                            placeholder={`liam.anderson@untressed.com\nnoah.miller@untressed.com\noliver.davis@untressed.com\n...or format as: Liam Anderson, liam.anderson@untressed.com`}
                            className="form-input"
                            style={{ fontFamily: 'monospace', fontSize: '12.5px', resize: 'vertical', lineHeight: 1.5 }}
                        />

                        {aliasSyncResult && (
                            <div style={{
                                padding: '12px 16px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                background: aliasSyncResult.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                border: `1px solid ${aliasSyncResult.type === 'success' ? '#10b981' : '#ef4444'}`,
                                color: aliasSyncResult.type === 'success' ? '#10b981' : '#ef4444'
                            }}>
                                {aliasSyncResult.message}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                                All aliases will automatically inherit your verified Google SMTP authorization.
                            </span>
                            <button
                                type="button"
                                onClick={handleSyncAliases}
                                disabled={syncingAliases || !aliasesText.trim()}
                                className="btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px' }}
                            >
                                <UploadCloud size={16} />
                                <span>{syncingAliases ? 'Syncing to Mailbox Hub...' : 'Register & Sync Aliases to Mailbox Hub'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================== */}
            {/* TAB 2: HOSTINGER AGENTIC MAIL API */}
            {/* ========================================== */}
            {activeTab === 'hostinger' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Status Banner */}
                    <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: hostingerStatus.configured ? '4px solid #10b981' : '4px solid #f87171' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: hostingerStatus.configured ? 'rgba(16,185,129,0.12)' : 'rgba(248,113,113,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: hostingerStatus.configured ? '#10b981' : '#f87171' }}>
                                {hostingerStatus.configured ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                            </div>
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: 0 }}>
                                    {hostingerStatus.configured ? 'Hostinger Agentic Mail API Connected' : 'Hostinger API Not Configured'}
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                                    {hostingerStatus.configured ? (
                                        <>Active Domain: <strong style={{ color: '#fff' }}>{hostingerStatus.domain}</strong> (Key: <code>{hostingerStatus.maskedKey}</code>)</>
                                    ) : (
                                        'Connect your Hostinger Business Email account via Agentic Mail API for automated mailbox provisioning and sync.'
                                    )}
                                </p>
                            </div>
                        </div>

                        {hostingerStatus.configured && (
                            <button
                                onClick={handleSyncHostingerApi}
                                disabled={syncingHostinger}
                                className="btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontSize: '13px' }}
                            >
                                <RefreshCw size={15} className={syncingHostinger ? 'spin' : ''} />
                                <span>{syncingHostinger ? 'Syncing...' : 'Sync All Hostinger Inboxes'}</span>
                            </button>
                        )}
                    </div>

                    {hostingerBanner && (
                        <div style={{
                            padding: '12px 16px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            background: hostingerBanner.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            border: `1px solid ${hostingerBanner.type === 'success' ? '#10b981' : '#ef4444'}`,
                            color: hostingerBanner.type === 'success' ? '#10b981' : '#ef4444'
                        }}>
                            {hostingerBanner.text}
                        </div>
                    )}

                    {/* Hostinger API Key Form */}
                    <form onSubmit={handleSaveHostingerKey} className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                            <Cpu size={18} style={{ color: 'var(--accent-color)' }} />
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Configure Hostinger API Credentials</span>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                Hostinger Agentic Mail API Token
                            </label>
                            <input 
                                type="password" 
                                value={hostingerTokenInput} 
                                onChange={e => setHostingerTokenInput(e.target.value)} 
                                placeholder={hostingerStatus.maskedKey || "Paste your 64-character Hostinger API Token"} 
                                className="form-input" 
                                style={{ fontFamily: 'monospace', fontSize: '13px' }}
                            />
                            <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--text-dim)' }}>
                                💡 Find this in Hostinger hPanel → <strong>Emails</strong> → <strong>Agentic Mail</strong> → <strong>API Access</strong>.
                            </p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                type="submit"
                                disabled={savingHostingerToken || !hostingerTokenInput.trim()}
                                className="btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px' }}
                            >
                                <Lock size={15} />
                                <span>{savingHostingerToken ? 'Verifying with Hostinger...' : 'Save & Verify Hostinger Token'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ========================================== */}
            {/* TAB 3: INBOUND CLOUDFLARE ROUTING */}
            {/* ========================================== */}
            {activeTab === 'cloudflare' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                            <Globe size={18} style={{ color: 'var(--accent-color)' }} />
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Inbound Email Routing via Cloudflare</span>
                        </div>

                        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                            Cloudflare Email Routing receives all incoming customer replies and forwards them directly into your CRM and Gmail inboxes in real-time.
                        </p>

                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                                Inbound Webhook URL (HTTP POST)
                            </label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input
                                    type="text"
                                    readOnly
                                    value={webhookUrl}
                                    className="form-input"
                                    style={{ fontFamily: 'monospace', fontSize: '13px', background: 'var(--bg-secondary)', color: 'var(--accent-color)' }}
                                />
                                <button
                                    onClick={copyWebhook}
                                    className="btn-secondary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 18px', whiteSpace: 'nowrap' }}
                                >
                                    {copiedWebhook ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                                    <span>{copiedWebhook ? 'Copied!' : 'Copy URL'}</span>
                                </button>
                            </div>
                        </div>

                        <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '10px', padding: '16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            <strong>Quick Setup Guide:</strong>
                            <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                                <li>Log into <strong>dash.cloudflare.com</strong> and select your domain.</li>
                                <li>Navigate to <strong>Email Routing</strong> → <strong>Routing Rules</strong>.</li>
                                <li>Ensure destination address is set to <strong>growth.untressed@gmail.com</strong> (or use an Email Worker with the Webhook URL above).</li>
                                <li>All replies will immediately synchronize into your CRM inbox!</li>
                            </ol>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================== */}
            {/* TAB 4: CUSTOM SMTP / OTHER PROVIDERS */}
            {/* ========================================== */}
            {activeTab === 'custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <form onSubmit={(e) => handleSaveAndVerify(e, provider)} className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                            <Server size={18} style={{ color: 'var(--accent-color)' }} />
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Custom Outbound SMTP / Relay</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    Outbound Provider
                                </label>
                                <CustomDropdown 
                                    value={provider} 
                                    onChange={val => {
                                        setProvider(val);
                                        if (val === 'resend') { setSmtpHost('smtp.resend.com'); setSmtpPort(465); }
                                        else if (val === 'brevo') { setSmtpHost('smtp-relay.brevo.com'); setSmtpPort(587); }
                                        else if (val === 'outlook') { setSmtpHost('smtp.office365.com'); setSmtpPort(587); }
                                    }} 
                                    options={[
                                        { value: 'resend', label: 'Resend (Free 3,000/mo - Recommended)', icon: '⚡' },
                                        { value: 'brevo', label: 'Brevo / Sendinblue (Free 300/day)', icon: '🚀' },
                                        { value: 'outlook', label: 'Microsoft Outlook / Office 365', icon: '📫' },
                                        { value: 'custom', label: 'Custom cPanel / Private SMTP', icon: '⚙️' }
                                    ]}
                                    width="100%"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    Sender Email Address
                                </label>
                                <input 
                                    type="email" 
                                    required 
                                    value={emailUser} 
                                    onChange={e => setEmailUser(e.target.value)} 
                                    placeholder="outreach@yourdomain.com" 
                                    className="form-input" 
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                SMTP Password or API Key
                            </label>
                            <input 
                                type="password" 
                                value={emailPass} 
                                onChange={e => setEmailPass(e.target.value)} 
                                placeholder={hasPass ? '••••••••••••••••••••••••••••••••' : 'Enter password or API key'} 
                                className="form-input" 
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    SMTP Host
                                </label>
                                <input 
                                    type="text" 
                                    value={smtpHost} 
                                    onChange={e => setSmtpHost(e.target.value)} 
                                    placeholder="smtp.resend.com" 
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
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                            <button type="submit" disabled={saving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px' }}>
                                <Lock size={15} />
                                <span>{saving ? 'Testing & Saving...' : 'Save & Verify Custom SMTP'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ========================================== */}
            {/* TAB 5: TEAM MAILBOXES AUDIT (ADMIN ONLY) */}
            {/* ========================================== */}
            {activeTab === 'team' && isAdmin && (
                <div className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Users size={18} style={{ color: 'var(--accent-color)' }} />
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>Team Email Configuration Audit</h3>
                        </div>
                        <button onClick={fetchTeamMailboxes} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                            <RefreshCw size={14} className={loadingTeam ? 'spin' : ''} />
                            <span>Refresh</span>
                        </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                    <th style={{ padding: '10px 12px' }}>User</th>
                                    <th style={{ padding: '10px 12px' }}>Role</th>
                                    <th style={{ padding: '10px 12px' }}>Domain Email</th>
                                    <th style={{ padding: '10px 12px' }}>Provider</th>
                                    <th style={{ padding: '10px 12px' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {teamMailboxes.map(t => (
                                    <tr key={t.userId} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 600, color: '#fff' }}>{t.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{t.loginEmail}</div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{ textTransform: 'capitalize', background: 'rgba(255, 255, 255, 0.08)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                                                {t.role}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', fontFamily: 'monospace' }}>{t.domainEmail}</td>
                                        <td style={{ padding: '12px', textTransform: 'capitalize' }}>{t.provider}</td>
                                        <td style={{ padding: '12px' }}>
                                            {t.isConfigured ? (
                                                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <CheckCircle2 size={14} /> Connected
                                                </span>
                                            ) : (
                                                <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <AlertTriangle size={14} /> Unconfigured
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
