import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../context/ThemeContext';
import { 
    Zap, Server, Mail, MessageSquare, ShieldCheck, ArrowRight, CheckCircle2, 
    Star, Github, Users, Sparkles, TrendingUp, Layers, Send, Lock, 
    ChevronRight, ExternalLink, Terminal, Play
} from 'lucide-react';

const LandingPage = () => {
    const { user } = useAuth();
    const [copiedStep, setCopiedStep] = useState(false);

    const copyCloneCommand = () => {
        navigator.clipboard.writeText('git clone https://github.com/your-username/nexusreach-crm.git && cd nexusreach-crm && npm run install:all && npm run seed && npm run dev');
        setCopiedStep(true);
        setTimeout(() => setCopiedStep(false), 2000);
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            overflowX: 'hidden'
        }}>
            {/* Ambient Background Glows */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '1000px',
                height: '500px',
                background: 'radial-gradient(ellipse at top, rgba(124, 58, 237, 0.18) 0%, rgba(6, 182, 212, 0.08) 45%, transparent 70%)',
                pointerEvents: 'none',
                zIndex: 0
            }} />

            {/* Navigation Header */}
            <header style={{
                position: 'sticky',
                top: 0,
                zIndex: 50,
                backdropFilter: 'blur(16px)',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)'
            }}>
                <div style={{
                    maxWidth: '1240px',
                    margin: '0 auto',
                    padding: '16px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    {/* Brand Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)'
                        }}>
                            <Zap size={20} color="#fff" />
                        </div>
                        <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                            Nexus<span style={{ color: '#8b5cf6' }}>Reach</span>
                        </span>
                        <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: '#a78bfa',
                            border: '1px solid rgba(139, 92, 246, 0.3)'
                        }}>
                            v1.0 Open Source
                        </span>
                    </div>

                    {/* Desktop Navigation Links */}
                    <nav style={{ display: 'flex', alignItems: 'center', gap: '28px', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                        <a href="#features" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s' }}>Features</a>
                        <a href="#architecture" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s' }}>Architecture</a>
                        <a href="#compare" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s' }}>Compare</a>
                        <a href="#quickstart" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s' }}>Quick Start</a>
                    </nav>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <ThemeToggle />
                        <a 
                            href="https://github.com" 
                            target="_blank" 
                            rel="noreferrer"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 14px',
                                borderRadius: '8px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                textDecoration: 'none',
                                fontWeight: 500,
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <Github size={15} />
                            <span>GitHub</span>
                        </a>

                        <Link 
                            to={user ? "/dashboard" : "/login"}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 18px',
                                borderRadius: '8px',
                                background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                                color: '#fff',
                                fontSize: '13px',
                                fontWeight: 600,
                                textDecoration: 'none',
                                boxShadow: '0 4px 14px rgba(124, 58, 237, 0.4)',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <span>{user ? "Dashboard" : "Sign In"}</span>
                            <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section style={{
                position: 'relative',
                zIndex: 1,
                maxWidth: '1240px',
                margin: '0 auto',
                padding: '90px 24px 60px 24px',
                textAlign: 'center'
            }}>
                {/* Floating Tag */}
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 16px',
                    borderRadius: '20px',
                    background: 'rgba(139, 92, 246, 0.12)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    color: '#c4b5fd',
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '24px'
                }}>
                    <Sparkles size={14} color="#a78bfa" />
                    <span>Free & Open-Source Alternative to HubSpot & Lemlist</span>
                </div>

                {/* Main Headline */}
                <h1 style={{
                    fontSize: 'clamp(36px, 6vw, 68px)',
                    fontWeight: 900,
                    lineHeight: 1.08,
                    letterSpacing: '-1.5px',
                    maxWidth: '960px',
                    margin: '0 auto 24px auto'
                }}>
                    The Open-Source Multichannel CRM &{' '}
                    <span style={{
                        background: 'linear-gradient(135deg, #a78bfa 0%, #06b6d4 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        High-Volume Outreach Machine
                    </span>
                </h1>

                {/* Subheadline */}
                <p style={{
                    fontSize: 'clamp(16px, 2vw, 20px)',
                    color: '#94a3b8',
                    maxWidth: '780px',
                    margin: '0 auto 40px auto',
                    lineHeight: 1.6
                }}>
                    Rotate hundreds of mailboxes across <b>Hostinger Agentic Mail API</b>, <b>Google Workspace</b>, and <b>Outlook 365</b> with automated round-robin distribution, native WhatsApp Web messaging, and local AI lead intelligence.
                </p>

                {/* CTA Buttons */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    flexWrap: 'wrap',
                    marginBottom: '50px'
                }}>
                    <Link
                        to={user ? "/dashboard" : "/login"}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '14px 32px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                            color: '#fff',
                            fontSize: '15px',
                            fontWeight: 700,
                            textDecoration: 'none',
                            boxShadow: '0 8px 30px rgba(124, 58, 237, 0.45)',
                            transition: 'transform 0.2s, box-shadow 0.2s'
                        }}
                    >
                        <span>Launch NexusReach CRM</span>
                        <ArrowRight size={18} />
                    </Link>

                    <button
                        onClick={copyCloneCommand}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '14px 24px',
                            borderRadius: '10px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: '#e2e8f0',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <Terminal size={17} color="#06b6d4" />
                        <span>{copiedStep ? '✓ Copied Command!' : 'Copy Clone Command'}</span>
                    </button>
                </div>

                {/* Key Metrics Banner */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    maxWidth: '1000px',
                    margin: '0 auto',
                    padding: '24px',
                    borderRadius: '16px',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(12px)'
                }}>
                    <div>
                        <div style={{ fontSize: '32px', fontWeight: 800, color: '#38bdf8' }}>Unlimited</div>
                        <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>Connected Mailboxes</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '32px', fontWeight: 800, color: '#a78bfa' }}>$0 / mo</div>
                        <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>100% Free & Open-Source</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '32px', fontWeight: 800, color: '#34d399' }}>100%</div>
                        <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>Self-Hosted Data Ownership</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '32px', fontWeight: 800, color: '#f472b6' }}>500+ msg/m</div>
                        <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>Round-Robin Throttle Engine</div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" style={{
                position: 'relative',
                zIndex: 1,
                maxWidth: '1240px',
                margin: '0 auto',
                padding: '90px 24px'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                        Architected for Growth
                    </div>
                    <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.5px', margin: 0 }}>
                        Engineered for High-Volume Outreach Without Limits
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '16px', maxWidth: '640px', margin: '12px auto 0 auto' }}>
                        Everything your sales team, marketing agency, or admissions bureau needs to capture, enrich, and convert leads.
                    </p>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                    gap: '24px'
                }}>
                    {/* Feature 1 */}
                    <div style={{
                        padding: '32px',
                        borderRadius: '16px',
                        background: 'rgba(15, 23, 42, 0.45)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        transition: 'transform 0.2s, border-color 0.2s'
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'rgba(6, 182, 212, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#06b6d4',
                            marginBottom: '20px'
                        }}>
                            <Server size={24} />
                        </div>
                        <h3 style={{ fontSize: '19px', fontWeight: 700, marginBottom: '10px' }}>
                            Mass Mailbox Pool & Smart Rotation
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                            Connect dozens or hundreds of sender mailboxes. Campaigns rotate automatically across your entire pool to protect domain reputation and bypass aggressive spam filters.
                        </p>
                    </div>

                    {/* Feature 2 */}
                    <div style={{
                        padding: '32px',
                        borderRadius: '16px',
                        background: 'rgba(15, 23, 42, 0.45)',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'rgba(139, 92, 246, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#a78bfa',
                            marginBottom: '20px'
                        }}>
                            <Zap size={24} />
                        </div>
                        <h3 style={{ fontSize: '19px', fontWeight: 700, marginBottom: '10px' }}>
                            Hostinger Agentic Mail API Integration
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                            Native integration with Hostinger’s modern Agentic Mail REST API. Dispatch thousands of messages directly through API endpoints with seamless fallback to high-speed SMTP.
                        </p>
                    </div>

                    {/* Feature 3 */}
                    <div style={{
                        padding: '32px',
                        borderRadius: '16px',
                        background: 'rgba(15, 23, 42, 0.45)',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#10b981',
                            marginBottom: '20px'
                        }}>
                            <MessageSquare size={24} />
                        </div>
                        <h3 style={{ fontSize: '19px', fontWeight: 700, marginBottom: '10px' }}>
                            Native WhatsApp Web Automation
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                            Scan your QR code once to trigger direct 1-to-1 WhatsApp messages and customized follow-up templates directly from the CRM without requiring paid third-party API gateways.
                        </p>
                    </div>

                    {/* Feature 4 */}
                    <div style={{
                        padding: '32px',
                        borderRadius: '16px',
                        background: 'rgba(15, 23, 42, 0.45)',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#f59e0b',
                            marginBottom: '20px'
                        }}>
                            <Layers size={24} />
                        </div>
                        <h3 style={{ fontSize: '19px', fontWeight: 700, marginBottom: '10px' }}>
                            Visual Kanban & Dynamic Pipeline
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                            Drag-and-drop leads across pipeline stages (New, Contacted, Engaged, Converted). Import tens of thousands of contacts via CSV with instant column mapping and deduplication.
                        </p>
                    </div>

                    {/* Feature 5 */}
                    <div style={{
                        padding: '32px',
                        borderRadius: '16px',
                        background: 'rgba(15, 23, 42, 0.45)',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'rgba(236, 72, 153, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ec4899',
                            marginBottom: '20px'
                        }}>
                            <Sparkles size={24} />
                        </div>
                        <h3 style={{ fontSize: '19px', fontWeight: 700, marginBottom: '10px' }}>
                            AI Lead Heat Scoring & Response Drafts
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                            Classify leads into Hot, Warm, and Cold based on sentiment and response frequency. Run local offline Ollama LLMs or HuggingFace inference for instant email drafting.
                        </p>
                    </div>

                    {/* Feature 6 */}
                    <div style={{
                        padding: '32px',
                        borderRadius: '16px',
                        background: 'rgba(15, 23, 42, 0.45)',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#6366f1',
                            marginBottom: '20px'
                        }}>
                            <Lock size={24} />
                        </div>
                        <h3 style={{ fontSize: '19px', fontWeight: 700, marginBottom: '10px' }}>
                            Role-Based Mailbox Allocation
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                            Partition inboxes among team members. Master Administrators can assign specific mailboxes to Admins or Mail Pedia specialists with strict data privacy and access control.
                        </p>
                    </div>
                </div>
            </section>

            {/* Comparison Section */}
            <section id="compare" style={{
                position: 'relative',
                zIndex: 1,
                maxWidth: '1060px',
                margin: '0 auto',
                padding: '80px 24px'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                        The Transparent Choice
                    </div>
                    <h2 style={{ fontSize: '32px', fontWeight: 800 }}>
                        NexusReach vs. Legacy Commercial Tools
                    </h2>
                </div>

                <div style={{
                    overflowX: 'auto',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(15, 23, 42, 0.5)'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.03)' }}>
                                <th style={{ padding: '16px 20px', color: '#94a3b8' }}>Capability</th>
                                <th style={{ padding: '16px 20px', color: '#38bdf8', fontWeight: 700 }}>⚡ NexusReach CRM</th>
                                <th style={{ padding: '16px 20px', color: '#94a3b8' }}>Lemlist / Smartlead</th>
                                <th style={{ padding: '16px 20px', color: '#94a3b8' }}>HubSpot CRM</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <td style={{ padding: '14px 20px', fontWeight: 600 }}>Monthly Cost</td>
                                <td style={{ padding: '14px 20px', color: '#34d399', fontWeight: 700 }}>$0 (100% Free)</td>
                                <td style={{ padding: '14px 20px', color: '#f87171' }}>$59 - $200+/mo</td>
                                <td style={{ padding: '14px 20px', color: '#f87171' }}>$50 - $800+/mo</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <td style={{ padding: '14px 20px', fontWeight: 600 }}>Connected Inboxes</td>
                                <td style={{ padding: '14px 20px', color: '#34d399', fontWeight: 700 }}>Unlimited</td>
                                <td style={{ padding: '14px 20px', color: '#f87171' }}>Tiered / Extra Fee</td>
                                <td style={{ padding: '14px 20px', color: '#f87171' }}>Limited</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <td style={{ padding: '14px 20px', fontWeight: 600 }}>Hostinger Agentic Mail API</td>
                                <td style={{ padding: '14px 20px', color: '#34d399', fontWeight: 700 }}>Native REST API</td>
                                <td style={{ padding: '14px 20px', color: '#64748b' }}>❌ Not Supported</td>
                                <td style={{ padding: '14px 20px', color: '#64748b' }}>❌ Not Supported</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <td style={{ padding: '14px 20px', fontWeight: 600 }}>WhatsApp Web Engine</td>
                                <td style={{ padding: '14px 20px', color: '#34d399', fontWeight: 700 }}>Built-in Free Engine</td>
                                <td style={{ padding: '14px 20px', color: '#64748b' }}>❌ Not Supported</td>
                                <td style={{ padding: '14px 20px', color: '#f87171' }}>Paid Integrations</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '14px 20px', fontWeight: 600 }}>Data Ownership</td>
                                <td style={{ padding: '14px 20px', color: '#34d399', fontWeight: 700 }}>100% Private (Self-Hosted)</td>
                                <td style={{ padding: '14px 20px', color: '#94a3b8' }}>Vendor Cloud</td>
                                <td style={{ padding: '14px 20px', color: '#94a3b8' }}>Vendor Cloud</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Quickstart Developer Section */}
            <section id="quickstart" style={{
                position: 'relative',
                zIndex: 1,
                maxWidth: '900px',
                margin: '0 auto',
                padding: '60px 24px 100px 24px'
            }}>
                <div style={{
                    padding: '36px',
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <h3 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>
                                ⚡ Start in 60 Seconds
                            </h3>
                            <p style={{ color: '#94a3b8', fontSize: '13.5px', margin: '4px 0 0 0' }}>
                                Pure Node.js & MongoDB architecture. Zero bloated containers.
                            </p>
                        </div>
                        <button
                            onClick={copyCloneCommand}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                background: 'rgba(139, 92, 246, 0.2)',
                                border: '1px solid rgba(139, 92, 246, 0.4)',
                                color: '#c4b5fd',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            {copiedStep ? '✓ Copied!' : 'Copy Shell Script'}
                        </button>
                    </div>

                    <pre style={{
                        background: '#040711',
                        padding: '20px',
                        borderRadius: '12px',
                        overflowX: 'auto',
                        fontSize: '13.5px',
                        fontFamily: 'monospace',
                        color: '#38bdf8',
                        lineHeight: 1.7,
                        margin: 0,
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                        <span style={{ color: '#64748b' }}># 1. Clone repository</span>{'\n'}
                        git clone https://github.com/your-username/nexusreach-crm.git{'\n'}
                        cd nexusreach-crm{'\n\n'}
                        <span style={{ color: '#64748b' }}># 2. Install all dependencies across backend & frontend</span>{'\n'}
                        npm run install:all{'\n\n'}
                        <span style={{ color: '#64748b' }}># 3. Configure environment and seed default accounts</span>{'\n'}
                        cp backend/.env.example backend/.env{'\n'}
                        npm run seed{'\n\n'}
                        <span style={{ color: '#64748b' }}># 4. Launch development server</span>{'\n'}
                        npm run dev
                    </pre>

                    <div style={{ marginTop: '24px', textAlign: 'center' }}>
                        <Link
                            to={user ? "/dashboard" : "/login"}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '12px 28px',
                                borderRadius: '8px',
                                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                                color: '#fff',
                                fontSize: '14px',
                                fontWeight: 600,
                                textDecoration: 'none',
                                boxShadow: '0 4px 16px rgba(124, 58, 237, 0.4)'
                            }}
                        >
                            <span>Ready to Test? Sign In Portal</span>
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                background: '#040711',
                padding: '40px 24px',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '13px'
            }}>
                <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Zap size={16} color="#8b5cf6" />
                        <span style={{ color: '#f8fafc', fontWeight: 700 }}>NexusReach CRM</span>
                        <span>• Open-Source under MIT License</span>
                    </div>
                    <div>
                        <span>Built with ❤️ by open-source creators worldwide.</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
