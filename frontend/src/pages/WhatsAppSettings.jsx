import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { MessageSquare, CheckCircle2, AlertTriangle, RefreshCw, LogOut, RotateCcw, Copy, Check } from 'lucide-react';

const QR_PROVIDERS = [
    (qr) => `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(qr)}`,
    (qr) => `https://quickchart.io/qr?text=${encodeURIComponent(qr)}&size=260&margin=2`,
    (qr) => `https://chart.googleapis.com/chart?chs=260x260&cht=qr&chl=${encodeURIComponent(qr)}&choe=UTF-8`
];

const WhatsAppSettings = () => {
    const { api, whatsAppStatus, whatsAppQr, setWhatsAppStatus, setWhatsAppQr } = useAuth();
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [providerIndex, setProviderIndex] = useState(0);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const { data } = await api.get('/whatsapp/status');
                setWhatsAppStatus(data.status);
                setWhatsAppQr(data.qrCode);
            } catch (err) {
                console.error('[WHATSAPP SETTINGS] Error reading status:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchStatus();
    }, [api, setWhatsAppStatus, setWhatsAppQr]);

    // Reset provider index when QR changes
    useEffect(() => {
        setProviderIndex(0);
    }, [whatsAppQr]);

    const handleLogout = async () => {
        if (window.confirm('Are you sure you want to disconnect your WhatsApp account?')) {
            try {
                await api.post('/whatsapp/logout');
                toast.success('WhatsApp session disconnected.');
            } catch (err) {
                console.error('[WHATSAPP SETTINGS] Disconnect error:', err);
                toast.error('Failed to disconnect: ' + (err.response?.data?.message || err.message));
            }
        }
    };

    const handleConnect = async (forceFresh = false) => {
        setConnecting(true);
        try {
            await api.post('/whatsapp/connect', { forceFresh });
            setWhatsAppStatus('INITIALIZING');
            toast.info(forceFresh ? 'Cleaning cache and starting fresh session...' : 'Starting WhatsApp connection...');
        } catch (err) {
            console.error('[WHATSAPP SETTINGS] Connect error:', err);
            toast.error('Failed to initialize WhatsApp: ' + (err.response?.data?.message || err.message));
        } finally {
            setConnecting(false);
        }
    };

    const handleReset = async () => {
        if (!window.confirm('This will purge any previous WhatsApp session cache and restart a clean browser process to generate a new QR code. Continue?')) {
            return;
        }
        setResetting(true);
        try {
            await api.post('/whatsapp/reset');
            setWhatsAppStatus('INITIALIZING');
            setWhatsAppQr('');
            toast.success('WhatsApp session purged. Loading fresh QR code...');
        } catch (err) {
            console.error('[WHATSAPP SETTINGS] Reset error:', err);
            toast.error('Failed to reset session: ' + (err.response?.data?.message || err.message));
        } finally {
            setResetting(false);
        }
    };

    const handleCopyQr = () => {
        if (whatsAppQr) {
            navigator.clipboard.writeText(whatsAppQr);
            setCopied(true);
            toast.success('QR Code raw pairing token copied to clipboard!');
            setTimeout(() => setCopied(false), 2500);
        }
    };

    const handleImageError = () => {
        if (providerIndex < QR_PROVIDERS.length - 1) {
            console.warn(`[WHATSAPP QR] Provider ${providerIndex} failed, falling back to provider ${providerIndex + 1}`);
            setProviderIndex(prev => prev + 1);
        } else {
            console.error('[WHATSAPP QR] All QR rendering providers failed.');
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Loading WhatsApp session status...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ maxWidth: '640px', margin: '0 auto' }}>
            <header style={{ marginBottom: '32px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '6px' }}>WhatsApp Integration</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Link your WhatsApp account to send live chats & automated outreach directly from CRM V2</p>
            </header>

            <div className="glass-panel" style={{ padding: '36px', textAlign: 'center' }}>
                
                {/* 1. Connected Status */}
                {whatsAppStatus === 'CONNECTED' && (
                    <div>
                        <div style={{ display: 'inline-flex', padding: '16px', background: 'rgba(16, 185, 129, 0.12)', borderRadius: '50%', color: '#10b981', marginBottom: '20px' }}>
                            <CheckCircle2 size={48} />
                        </div>
                        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>WhatsApp Connected!</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '14px', lineHeight: 1.6 }}>
                            Your WhatsApp Web session is linked and active. You can send messages directly from the Lead Details drawer and receive replies in the WhatsApp Inbox.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                            <button onClick={handleLogout} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>
                                <LogOut size={16} />
                                <span>Disconnect Session</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* 2. Loading State */}
                {whatsAppStatus === 'INITIALIZING' && (
                    <div style={{ padding: '20px 0' }}>
                        <RefreshCw size={44} className="spin" style={{ color: 'var(--accent-color)', marginBottom: '16px', animation: 'spin 1.8s linear infinite' }} />
                        <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Initializing WhatsApp Engine...</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '420px', margin: '0 auto 24px', lineHeight: 1.5 }}>
                            Launching browser profile and fetching official WhatsApp Web pairing credentials. This usually takes 10–20 seconds.
                        </p>
                        
                        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', maxWidth: '400px', margin: '0 auto 20px', fontSize: '13px', color: 'var(--text-dim)' }}>
                            <span>Taking longer than usual or stuck?</span>
                        </div>
                        <button 
                            onClick={handleReset} 
                            disabled={resetting}
                            className="btn-secondary" 
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px 16px' }}
                        >
                            <RotateCcw size={14} className={resetting ? 'spin' : ''} />
                            <span>{resetting ? 'Resetting...' : 'Force Fresh Reset'}</span>
                        </button>
                    </div>
                )}

                {/* 3. QR Code Presentation */}
                {whatsAppStatus === 'QR_READY' && whatsAppQr && (
                    <div>
                        <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(139, 92, 246, 0.12)', borderRadius: '50%', color: 'var(--accent-color)', marginBottom: '16px' }}>
                            <MessageSquare size={32} />
                        </div>
                        <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Scan QR Code with Phone</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '440px', margin: '0 auto 20px', lineHeight: 1.5 }}>
                            Open WhatsApp on your phone → Tap <b>Menu</b> or <b>Settings</b> → Tap <b>Linked Devices</b> → Tap <b>Link a Device</b>.
                        </p>
                        
                        {/* QR Code Container */}
                        <div style={{
                            background: '#ffffff',
                            padding: '16px',
                            borderRadius: '16px',
                            display: 'inline-block',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                            marginBottom: '20px',
                            border: '3px solid rgba(139, 92, 246, 0.3)'
                        }}>
                            <img 
                                key={`${whatsAppQr.slice(0, 10)}-${providerIndex}`}
                                src={QR_PROVIDERS[providerIndex](whatsAppQr)}
                                alt="WhatsApp Pairing QR Code"
                                onError={handleImageError}
                                style={{ display: 'block', width: '250px', height: '250px', borderRadius: '4px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-dim)', fontSize: '12.5px', marginBottom: '24px' }}>
                            <RefreshCw size={13} className="spin" style={{ animation: 'spin 3s linear infinite' }} />
                            <span>Auto-refreshes automatically as WhatsApp rotates security keys</span>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <button
                                onClick={handleReset}
                                disabled={resetting}
                                className="btn-secondary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '9px 16px' }}
                            >
                                <RotateCcw size={14} className={resetting ? 'spin' : ''} />
                                <span>{resetting ? 'Regenerating...' : 'Regenerate QR'}</span>
                            </button>

                            <button
                                onClick={handleCopyQr}
                                className="btn-secondary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '9px 16px' }}
                                title="Copy raw QR pairing token"
                            >
                                {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                <span>{copied ? 'Copied!' : 'Copy Pairing Key'}</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* 4. Default / Disconnected fallback */}
                {whatsAppStatus === 'DISCONNECTED' && (
                    <div>
                        <div style={{ display: 'inline-flex', padding: '16px', background: 'rgba(239, 68, 68, 0.12)', borderRadius: '50%', color: '#f87171', marginBottom: '20px' }}>
                            <AlertTriangle size={48} />
                        </div>
                        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>WhatsApp Disconnected</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '14.5px', maxWidth: '440px', margin: '0 auto 28px' }}>
                            No active WhatsApp session linked. Initialize the browser engine to generate your linking QR code.
                        </p>
                        
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <button 
                                onClick={() => handleConnect(false)} 
                                disabled={connecting} 
                                className="btn-primary" 
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                            >
                                <RefreshCw size={16} className={connecting ? 'spin' : ''} style={{ animation: connecting ? 'spin 1.5s linear infinite' : 'none' }} />
                                <span>{connecting ? 'Starting...' : 'Connect & Generate QR'}</span>
                            </button>

                            <button 
                                onClick={() => handleConnect(true)} 
                                disabled={connecting || resetting} 
                                className="btn-secondary" 
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                                title="Clean old session locks and generate fresh QR"
                            >
                                <RotateCcw size={16} />
                                <span>Clean Reset & New QR</span>
                            </button>
                        </div>
                    </div>
                )}

            </div>
            
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default WhatsAppSettings;
