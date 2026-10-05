import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import SalesLogin from './pages/SalesLogin';
import Dashboard from './pages/Dashboard';
import LeadsTable from './pages/LeadsTable';
import ManageSales from './pages/ManageSales';
import WhatsAppSettings from './pages/WhatsAppSettings';
import WhatsAppInbox from './pages/WhatsAppInbox';
import EmailSettings from './pages/EmailSettings';
import EmailInbox from './pages/EmailInbox';
import MailboxManager from './pages/MailboxManager';
import CampaignManager from './pages/CampaignManager';
import { LayoutDashboard, Users, UsersRound, MessageSquareCode, LogOut, MessageSquare, Mail, Inbox, Send, Server } from 'lucide-react';

const Layout = ({ children }) => {
    const { user, logout } = useAuth();
    const location = useLocation();

    // Check if link is active
    const isActive = (path) => location.pathname === path;

    const handleLogoutConfirm = () => {
        if (window.confirm('Are you sure you want to log out of CRM V2?')) {
            logout();
        }
    };

    return (
        <div className="app-container">
            {/* Sidebar Navigation */}
            <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }}>
                <div className="logo-section" style={{ flexShrink: 0 }}>
                    <span className="logo-text">CRM V2</span>
                </div>
                
                <ul className="nav-links" style={{ flexGrow: 1 }}>
                    <li className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}>
                        <Link to="/dashboard">
                            <LayoutDashboard size={20} />
                            <span>Dashboard</span>
                        </Link>
                    </li>
                    <li className={`nav-item ${isActive('/leads') ? 'active' : ''}`}>
                        <Link to="/leads">
                            <Users size={20} />
                            <span>Leads</span>
                        </Link>
                    </li>
                    
                    {/* Admins / Masters see team & roles management */}
                    {['master', 'admin', 'manager'].includes(user?.role) && (
                        <li className={`nav-item ${isActive('/sales') ? 'active' : ''}`}>
                            <Link to="/sales">
                                <UsersRound size={20} />
                                <span>Team & Roles</span>
                            </Link>
                        </li>
                    )}

                    {/* Email Campaigns & Multi-Mailbox Manager for Mail Pedia, Master, & Admin */}
                    {['master', 'admin', 'mail_pedia'].includes(user?.role) && (
                        <>
                            <li className={`nav-item ${isActive('/campaigns') ? 'active' : ''}`}>
                                <Link to="/campaigns">
                                    <Send size={20} />
                                    <span>Campaigns</span>
                                </Link>
                            </li>
                            <li className={`nav-item ${isActive('/mailboxes') ? 'active' : ''}`}>
                                <Link to="/mailboxes">
                                    <Server size={20} />
                                    <span>Hostinger Mailboxes</span>
                                </Link>
                            </li>
                        </>
                    )}

                    {/* WhatsApp tools (for Sales, Admin, Master) */}
                    {user?.role !== 'mail_pedia' && (
                        <>
                            <li className={`nav-item ${isActive('/whatsapp-inbox') ? 'active' : ''}`}>
                                <Link to="/whatsapp-inbox">
                                    <MessageSquare size={20} />
                                    <span>WhatsApp Inbox</span>
                                </Link>
                            </li>

                            <li className={`nav-item ${isActive('/whatsapp-settings') ? 'active' : ''}`}>
                                <Link to="/whatsapp-settings">
                                    <MessageSquareCode size={20} />
                                    <span>WhatsApp Link</span>
                                </Link>
                            </li>
                        </>
                    )}

                    <li className={`nav-item ${isActive('/email-inbox') ? 'active' : ''}`}>
                        <Link to="/email-inbox">
                            <Inbox size={20} />
                            <span>Email Inbox</span>
                        </Link>
                    </li>

                    {user?.role !== 'mail_pedia' && (
                        <li className={`nav-item ${isActive('/email-settings') ? 'active' : ''}`}>
                            <Link to="/email-settings">
                                <Mail size={20} />
                                <span>Email Settings</span>
                            </Link>
                        </li>
                    )}
                </ul>

                {/* Logged in User Profile Info Card */}
                <div className="user-profile-section" style={{
                    flexDirection: 'column',
                    gap: '12px',
                    alignItems: 'stretch',
                    marginTop: '20px',
                    flexShrink: 0,
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '14px',
                            flexShrink: 0
                        }}>
                            {user?.name ? user.name[0].toUpperCase() : 'U'}
                        </div>
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: '13px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {user?.name}
                            </p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'capitalize', margin: '2px 0 0 0' }}>
                                {user?.role} • {user?.designation || 'Staff'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleLogoutConfirm} 
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            cursor: 'pointer',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <LogOut size={14} />
                        <span>Log Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Application Page Canvas */}
            <main className="main-canvas">
                {children}
            </main>
        </div>
    );
};

// Route controller that enforces login
const ProtectedRoute = ({ children }) => {
    const { user } = useAuth();
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    return <Layout>{children}</Layout>;
};

const AppContent = () => {
    const { user } = useAuth();

    return (
        <Routes>
            {/* Public Login Route */}
            <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <SalesLogin />} />

            {/* Protected Routes */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute><LeadsTable /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><ManageSales /></ProtectedRoute>} />
            <Route path="/whatsapp-inbox" element={<ProtectedRoute><WhatsAppInbox /></ProtectedRoute>} />
            <Route path="/whatsapp-settings" element={<ProtectedRoute><WhatsAppSettings /></ProtectedRoute>} />
            <Route path="/email-inbox" element={<ProtectedRoute><EmailInbox /></ProtectedRoute>} />
            <Route path="/email-settings" element={<ProtectedRoute><EmailSettings /></ProtectedRoute>} />
            <Route path="/mailboxes" element={<ProtectedRoute><MailboxManager /></ProtectedRoute>} />
            <Route path="/campaigns" element={<ProtectedRoute><CampaignManager /></ProtectedRoute>} />

            {/* Fallbacks */}
            <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
        </Routes>
    );
};

const App = () => {
    return (
        <ToastProvider>
            <AuthProvider>
                <BrowserRouter>
                    <AppContent />
                </BrowserRouter>
            </AuthProvider>
        </ToastProvider>
    );
};

export default App;
