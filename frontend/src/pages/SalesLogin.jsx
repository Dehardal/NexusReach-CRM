import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, User, Lock, ArrowRight, Eye, EyeOff, Sparkles, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '../context/ThemeContext';

const SalesLogin = () => {
    const { login, googleLogin } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    // Initialize Google Identity Services (GIS) if Client ID is configured
    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId) return;

        const loadGoogleScript = () => {
            if (window.google?.accounts?.id) {
                initializeGis(clientId);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => initializeGis(clientId);
            document.head.appendChild(script);
        };

        const initializeGis = (cid) => {
            try {
                window.google.accounts.id.initialize({
                    client_id: cid,
                    callback: handleGoogleCredentialResponse,
                    auto_select: false
                });

                const btnContainer = document.getElementById('googleGisContainer');
                if (btnContainer) {
                    window.google.accounts.id.renderButton(btnContainer, {
                        theme: 'filled_black',
                        size: 'large',
                        width: 340,
                        text: 'continue_with',
                        shape: 'rectangular'
                    });
                }
            } catch (err) {
                console.warn('[GIS INIT WARNING]', err);
            }
        };

        loadGoogleScript();
    }, []);

    const handleGoogleCredentialResponse = async (response) => {
        if (!response.credential) return;
        setError('');
        setGoogleLoading(true);
        try {
            await googleLogin(response.credential);
        } catch (err) {
            setError(err.response?.data?.message || 'Google authentication failed. Please try again.');
        } finally {
            setGoogleLoading(false);
        }
    };

    // Fallback one-click Master sign-in for local development when Google Client ID isn't set yet
    const handleOneClickGoogleDev = async () => {
        setError('');
        setGoogleLoading(true);
        try {
            // Check if user has GIS configured
            const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
            if (clientId && window.google?.accounts?.id) {
                window.google.accounts.id.prompt();
                return;
            }

            // In local development without Google Cloud keys configured, prompt for Master Google email
            const masterEmail = prompt('Enter your Google Account email for Master access:', 'admin@example.com');
            if (!masterEmail) {
                setGoogleLoading(false);
                return;
            }

            await googleLogin({
                email: masterEmail,
                name: masterEmail.split('@')[0]
            });
        } catch (err) {
            setError(err.response?.data?.message || 'Google sign-in failed.');
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            await login(email, password);
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'radial-gradient(circle at 10% 20%, rgba(124, 58, 237, 0.12) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(6, 182, 212, 0.08) 0%, transparent 40%), var(--bg-primary)'
        }}>
            <div className="glass-panel animate-fade-in" style={{
                maxWidth: '440px',
                width: '100%',
                padding: '38px',
                border: '1px solid var(--border-color)'
            }}>
                {/* Back to Home & Theme Toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <Link to="/" style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--text-secondary)',
                        fontSize: '12.5px',
                        textDecoration: 'none',
                        transition: 'color 0.2s'
                    }}>
                        <Home size={14} />
                        <span>Back to Home</span>
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: '#a78bfa',
                            fontWeight: 600
                        }}>
                            v1.0 Open Source
                        </span>
                        <ThemeToggle />
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '24px' }}>⚡</span>
                        <h1 style={{ fontSize: '28px', fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>
                            Nexus<span style={{ color: 'var(--accent-color)' }}>Reach</span>
                        </h1>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', margin: '4px 0 0 0' }}>
                        Enterprise Outreach & Lead Automation Portal
                    </p>
                </div>

                {error && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 16px',
                        color: '#f87171',
                        fontSize: '13px',
                        marginBottom: '20px'
                    }}>
                        <ShieldAlert size={18} style={{ flexShrink: 0 }} />
                        <span>{error}</span>
                    </div>
                )}

                {/* 1. Google 1-Click Master Sign In */}
                <div style={{ marginBottom: '20px' }}>
                    <div id="googleGisContainer" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}></div>

                    {/* Styled Fallback Google Button */}
                    <button
                        type="button"
                        onClick={handleOneClickGoogleDev}
                        disabled={googleLoading}
                        style={{
                            width: '100%',
                            padding: '11px 16px',
                            borderRadius: '10px',
                            background: '#ffffff',
                            color: '#1f2937',
                            border: '1px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            fontSize: '13.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>{googleLoading ? 'Connecting with Google...' : 'Sign in with Google (Master)'}</span>
                    </button>
                    <p style={{ margin: '6px 0 0 0', fontSize: '11px', textAlign: 'center', color: 'var(--text-dim)' }}>
                        🔒 Instant access for Master Architect (configured via MASTER_EMAIL)
                    </p>
                </div>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '22px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        or sign in with password
                    </span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
                </div>

                {/* 2. Password Login Form (For Staff & Open Source Contributors) */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Email Address
                        </label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="form-input"
                                placeholder="admin@crm.com"
                                style={{ paddingLeft: '46px' }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="form-input"
                                placeholder="••••••••"
                                style={{ paddingLeft: '46px', paddingRight: '46px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '16px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-dim)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 0
                                }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="btn-primary"
                        style={{
                            marginTop: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            padding: '12px',
                            fontSize: '14px',
                            fontWeight: 600
                        }}
                    >
                        {submitting ? 'Authenticating...' : 'Sign In with Password'}
                        <ArrowRight size={18} />
                    </button>
                </form>

                {/* Quick Seed Hint for Contributors */}
                <div style={{
                    marginTop: '24px',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    fontSize: '11.5px',
                    color: 'var(--text-secondary)',
                    textAlign: 'center'
                }}>
                    <span style={{ color: '#a78bfa', fontWeight: 600 }}>Demo Seed Passwords:</span>{' '}
                    <code>master@crm.com</code> / <code>master123</code> or <code>admin@crm.com</code> / <code>admin123</code>
                </div>
            </div>
        </div>
    );
};

export default SalesLogin;
