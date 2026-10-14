import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
    Bell, 
    X, 
    Check, 
    CheckCheck, 
    Server, 
    Users, 
    Send, 
    Zap, 
    Clock, 
    Inbox, 
    Filter,
    Sparkles,
    Shield
} from 'lucide-react';

export const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 45) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 172800) return 'Yesterday';
    return `${Math.floor(diffSec / 86400)}d ago`;
};

const NotificationModal = ({ isOpen, onClose, onUnreadCountChange }) => {
    const { api, user, socket } = useAuth();
    const { info } = useToast();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [filterTab, setFilterTab] = useState('all'); // 'all' | 'unread' | 'mailbox_assigned' | 'lead_assigned'

    const fetchNotifications = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data } = await api.get('/notifications');
            setNotifications(data.notifications || []);
            setUnreadCount(data.unreadCount || 0);
            if (onUnreadCountChange) onUnreadCountChange(data.unreadCount || 0);
        } catch (err) {
            console.error('[NOTIFICATIONS FETCH ERROR]', err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchNotifications();
        }
    }, [user]);

    // Real-time socket listener for incoming notifications
    useEffect(() => {
        if (!socket || !user) return;

        const handleNewNotification = (data) => {
            // Check if this notification is for the current user
            if (data?.recipientId === user._id?.toString() || data?.recipientId === user.id?.toString()) {
                const notif = data.notification;
                setNotifications(prev => [notif, ...prev]);
                setUnreadCount(prev => {
                    const next = prev + 1;
                    if (onUnreadCountChange) onUnreadCountChange(next);
                    return next;
                });

                // Display quick toast alert
                info(`🔔 ${notif.title}: ${notif.message}`);
            }
        };

        socket.on('new_notification', handleNewNotification);

        return () => {
            socket.off('new_notification', handleNewNotification);
        };
    }, [socket, user, info, onUnreadCountChange]);

    const handleMarkAsRead = async (id, e) => {
        if (e) e.stopPropagation();
        try {
            const { data } = await api.put(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
            setUnreadCount(data.unreadCount !== undefined ? data.unreadCount : Math.max(0, unreadCount - 1));
            if (onUnreadCountChange) {
                onUnreadCountChange(data.unreadCount !== undefined ? data.unreadCount : Math.max(0, unreadCount - 1));
            }
        } catch (err) {
            console.error('[MARK READ ERROR]', err);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await api.put('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
            if (onUnreadCountChange) onUnreadCountChange(0);
        } catch (err) {
            console.error('[MARK ALL READ ERROR]', err);
        }
    };

    if (!isOpen) return null;

    const filteredList = notifications.filter(n => {
        if (filterTab === 'unread') return !n.isRead;
        if (filterTab === 'mailbox_assigned') return n.type === 'mailbox_assigned';
        if (filterTab === 'lead_assigned') return n.type === 'lead_assigned';
        return true;
    });

    const getIconForType = (type) => {
        switch (type) {
            case 'mailbox_assigned':
                return {
                    icon: <Server size={18} color="#10b981" />,
                    bg: 'rgba(16, 185, 129, 0.15)',
                    border: 'rgba(16, 185, 129, 0.3)'
                };
            case 'lead_assigned':
                return {
                    icon: <Users size={18} color="#06b6d4" />,
                    bg: 'rgba(6, 182, 212, 0.15)',
                    border: 'rgba(6, 182, 212, 0.3)'
                };
            case 'campaign_alert':
                return {
                    icon: <Send size={18} color="#f59e0b" />,
                    bg: 'rgba(245, 158, 11, 0.15)',
                    border: 'rgba(245, 158, 11, 0.3)'
                };
            default:
                return {
                    icon: <Bell size={18} color="#8b5cf6" />,
                    bg: 'rgba(139, 92, 246, 0.15)',
                    border: 'rgba(139, 92, 246, 0.3)'
                };
        }
    };

    return (
        <div 
            className="modal-overlay" 
            onClick={onClose}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '16px'
            }}
        >
            <div 
                className="modal-content glass-panel" 
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '560px',
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '16px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(139, 92, 246, 0.15)',
                    overflow: 'hidden',
                    animation: 'modalSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
            >
                {/* Modal Header */}
                <div style={{
                    padding: '18px 22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                        }}>
                            <Bell size={18} color="#fff" />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Activity Notifications
                                </h3>
                                {unreadCount > 0 && (
                                    <span style={{
                                        fontSize: '11px',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        background: 'rgba(139, 92, 246, 0.25)',
                                        color: '#c4b5fd',
                                        fontWeight: 700,
                                        border: '1px solid rgba(139, 92, 246, 0.4)'
                                    }}>
                                        {unreadCount} unread
                                    </span>
                                )}
                            </div>
                            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                Real-time alerts for mailboxes, lead allocations, and CRM updates
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={handleMarkAllAsRead}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    transition: 'all 0.15s ease'
                                }}
                                title="Mark all notifications as read"
                            >
                                <CheckCheck size={14} color="#10b981" />
                                <span>Mark All Read</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div style={{
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'rgba(0, 0, 0, 0.15)',
                    overflowX: 'auto'
                }}>
                    <button
                        type="button"
                        onClick={() => setFilterTab('all')}
                        style={{
                            padding: '5px 12px',
                            borderRadius: '20px',
                            border: '1px solid',
                            borderColor: filterTab === 'all' ? '#8b5cf6' : 'transparent',
                            background: filterTab === 'all' ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
                            color: filterTab === 'all' ? '#c4b5fd' : 'var(--text-secondary)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        All ({notifications.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterTab('unread')}
                        style={{
                            padding: '5px 12px',
                            borderRadius: '20px',
                            border: '1px solid',
                            borderColor: filterTab === 'unread' ? '#8b5cf6' : 'transparent',
                            background: filterTab === 'unread' ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
                            color: filterTab === 'unread' ? '#c4b5fd' : 'var(--text-secondary)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Unread ({unreadCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterTab('mailbox_assigned')}
                        style={{
                            padding: '5px 12px',
                            borderRadius: '20px',
                            border: '1px solid',
                            borderColor: filterTab === 'mailbox_assigned' ? '#10b981' : 'transparent',
                            background: filterTab === 'mailbox_assigned' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                            color: filterTab === 'mailbox_assigned' ? '#6ee7b7' : 'var(--text-secondary)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Mailboxes
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterTab('lead_assigned')}
                        style={{
                            padding: '5px 12px',
                            borderRadius: '20px',
                            border: '1px solid',
                            borderColor: filterTab === 'lead_assigned' ? '#06b6d4' : 'transparent',
                            background: filterTab === 'lead_assigned' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                            color: filterTab === 'lead_assigned' ? '#67e8f9' : 'var(--text-secondary)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Leads
                    </button>
                </div>

                {/* Notifications Scrollable List */}
                <div style={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '520px'
                }}>
                    {loading && notifications.length === 0 ? (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                            Loading notifications...
                        </div>
                    ) : filteredList.length === 0 ? (
                        <div style={{
                            padding: '48px 24px',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px'
                        }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                background: 'rgba(255, 255, 255, 0.04)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-dim)'
                            }}>
                                <Inbox size={24} />
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>
                                    {filterTab === 'unread' ? 'No unread notifications' : 'No notifications found'}
                                </h4>
                                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    {filterTab === 'unread' ? "You're completely up to date!" : "Activity logs for mailbox and lead assignments will appear here."}
                                </p>
                            </div>
                        </div>
                    ) : (
                        filteredList.map((notif) => {
                            const iconStyle = getIconForType(notif.type);
                            return (
                                <div
                                    key={notif._id}
                                    onClick={() => !notif.isRead && handleMarkAsRead(notif._id)}
                                    style={{
                                        padding: '12px 14px',
                                        borderRadius: '10px',
                                        background: notif.isRead ? 'rgba(255, 255, 255, 0.02)' : 'rgba(139, 92, 246, 0.08)',
                                        border: `1px solid ${notif.isRead ? 'rgba(255, 255, 255, 0.06)' : 'rgba(139, 92, 246, 0.28)'}`,
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '12px',
                                        transition: 'all 0.15s ease',
                                        cursor: notif.isRead ? 'default' : 'pointer',
                                        position: 'relative'
                                    }}
                                >
                                    {/* Type Icon Badge */}
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '8px',
                                        background: iconStyle.bg,
                                        border: `1px solid ${iconStyle.border}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        marginTop: '2px'
                                    }}>
                                        {iconStyle.icon}
                                    </div>

                                    {/* Content */}
                                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <h4 style={{ 
                                                    margin: 0, 
                                                    fontSize: '13.5px', 
                                                    fontWeight: notif.isRead ? 600 : 700, 
                                                    color: 'var(--text-primary)' 
                                                }}>
                                                    {notif.title}
                                                </h4>
                                                {!notif.isRead && (
                                                    <span style={{
                                                        width: '7px',
                                                        height: '7px',
                                                        borderRadius: '50%',
                                                        backgroundColor: '#8b5cf6',
                                                        boxShadow: '0 0 8px #8b5cf6',
                                                        display: 'inline-block'
                                                    }} />
                                                )}
                                            </div>
                                            <span style={{ fontSize: '11px', color: 'var(--text-dim)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Clock size={11} />
                                                {formatRelativeTime(notif.createdAt)}
                                            </span>
                                        </div>

                                        <p style={{ 
                                            margin: 0, 
                                            fontSize: '12.5px', 
                                            color: notif.isRead ? 'var(--text-secondary)' : 'var(--text-primary)', 
                                            lineHeight: 1.45,
                                            wordBreak: 'break-word'
                                        }}>
                                            {notif.message}
                                        </p>

                                        {/* Metadata / Sender Footnote */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                                            {notif.sender && (
                                                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                                    By: <strong style={{ color: 'var(--text-secondary)' }}>{notif.sender.name}</strong> ({notif.sender.role})
                                                </span>
                                            )}
                                            {notif.type === 'mailbox_assigned' && (
                                                <span style={{
                                                    fontSize: '10px',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    background: 'rgba(16, 185, 129, 0.15)',
                                                    color: '#10b981',
                                                    fontWeight: 600
                                                }}>
                                                    Hostinger Mailbox
                                                </span>
                                            )}
                                            {notif.type === 'lead_assigned' && (
                                                <span style={{
                                                    fontSize: '10px',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    background: 'rgba(6, 182, 212, 0.15)',
                                                    color: '#06b6d4',
                                                    fontWeight: 600
                                                }}>
                                                    Leads Allocation
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action to Mark Read */}
                                    {!notif.isRead && (
                                        <button
                                            type="button"
                                            onClick={(e) => handleMarkAsRead(notif._id, e)}
                                            style={{
                                                background: 'rgba(139, 92, 246, 0.15)',
                                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                                color: '#c4b5fd',
                                                cursor: 'pointer',
                                                padding: '4px 6px',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '3px',
                                                flexShrink: 0,
                                                alignSelf: 'center'
                                            }}
                                            title="Mark as read"
                                        >
                                            <Check size={12} />
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer status */}
                <div style={{
                    padding: '10px 18px',
                    borderTop: '1px solid var(--border-color)',
                    background: 'rgba(0, 0, 0, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11.5px',
                    color: 'var(--text-dim)'
                }}>
                    <span>Logged in as: <strong style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{user?.role}</strong></span>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#8b5cf6',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        Close Window
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationModal;
