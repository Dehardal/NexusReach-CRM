import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        return {
            showToast: (msg, type) => console.log(`[TOAST ${type}]`, msg),
            success: (msg) => console.log('[TOAST SUCCESS]', msg),
            error: (msg) => console.error('[TOAST ERROR]', msg),
            info: (msg) => console.log('[TOAST INFO]', msg)
        };
    }
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showToast = useCallback((message, type = 'info') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type }]);

        setTimeout(() => {
            removeToast(id);
        }, 4000);
    }, [removeToast]);

    const success = useCallback((msg) => showToast(msg, 'success'), [showToast]);
    const error = useCallback((msg) => showToast(msg, 'error'), [showToast]);
    const info = useCallback((msg) => showToast(msg, 'info'), [showToast]);

    return (
        <ToastContext.Provider value={{ showToast, success, error, info }}>
            {children}
            {/* Floating Toast Notification Container */}
            <div style={{
                position: 'fixed',
                top: '24px',
                right: '24px',
                zIndex: 999999,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                pointerEvents: 'none',
                maxWidth: '420px',
                width: 'calc(100vw - 48px)'
            }}>
                {toasts.map(t => (
                    <div 
                        key={t.id} 
                        className="animate-modal-in"
                        style={{
                            pointerEvents: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '14px 18px',
                            borderRadius: '12px',
                            background: '#12141c',
                            border: t.type === 'success' 
                                ? '1px solid rgba(52, 211, 153, 0.5)' 
                                : t.type === 'error' 
                                ? '1px solid rgba(248, 113, 113, 0.5)' 
                                : '1px solid rgba(139, 92, 246, 0.5)',
                            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: 500
                        }}
                    >
                        {t.type === 'success' && <CheckCircle2 size={20} style={{ color: '#34d399', flexShrink: 0 }} />}
                        {t.type === 'error' && <AlertCircle size={20} style={{ color: '#f87171', flexShrink: 0 }} />}
                        {t.type === 'info' && <Info size={20} style={{ color: '#a78bfa', flexShrink: 0 }} />}
                        
                        <span style={{ flexGrow: 1, wordBreak: 'break-word', lineHeight: 1.4 }}>{t.message}</span>
                        
                        <button 
                            onClick={() => removeToast(t.id)} 
                            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
