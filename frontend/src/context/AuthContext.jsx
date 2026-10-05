import { createContext, useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { io } from 'socket.io-client';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Create axios instance with configured API baseURL
const api = axios.create({
    baseURL: API_BASE_URL
});

// Global Authorization Interceptor: Reads directly from localStorage to prevent race conditions
api.interceptors.request.use(
    (config) => {
        const savedUserStr = localStorage.getItem('crm_user');
        if (savedUserStr) {
            try {
                const savedUser = JSON.parse(savedUserStr);
                if (savedUser && savedUser.token) {
                    config.headers.Authorization = `Bearer ${savedUser.token}`;
                }
            } catch (e) {
                console.error('[AUTH INTERCEPTOR] Error parsing saved user:', e);
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);
    const [whatsAppStatus, setWhatsAppStatus] = useState('DISCONNECTED');
    const [whatsAppQr, setWhatsAppQr] = useState('');

    const checkWhatsAppStatus = async () => {
        try {
            const { data } = await api.get('/whatsapp/status');
            if (data && data.status) {
                setWhatsAppStatus(data.status);
                if (data.qrCode) setWhatsAppQr(data.qrCode);
            }
        } catch (e) {
            console.error('[AUTH] Failed to fetch initial WhatsApp status:', e.message);
        }
    };

    // Setup Socket connection once user logs in
    useEffect(() => {
        if (user && user._id) {
            checkWhatsAppStatus();

            const isLocal = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1';

            const socketUrl = isLocal
                ? `${window.location.protocol}//${window.location.hostname}:12000`
                : window.location.origin;

            console.log('[SOCKET] Connecting to:', socketUrl);

            const newSocket = io(socketUrl, {
                transports: ['websocket', 'polling']
            });
            setSocket(newSocket);

            newSocket.on('connect', () => {
                console.log('[SOCKET] Connected to real-time events. Socket ID:', newSocket.id);
                checkWhatsAppStatus();
            });

            // Listen to WhatsApp Web QR code streams
            newSocket.on('whatsapp_qr', (qr) => {
                console.log('[SOCKET] New WhatsApp QR code generated.');
                setWhatsAppQr(qr);
                setWhatsAppStatus('QR_READY');
            });

            // Listen to WhatsApp Web connection status changes
            newSocket.on('whatsapp_status', (data) => {
                console.log('[SOCKET] WhatsApp status change:', data.status);
                setWhatsAppStatus(data.status);
                if (data.status === 'CONNECTED' || data.status === 'DISCONNECTED') {
                    setWhatsAppQr('');
                }
            });

            return () => {
                console.log('[SOCKET] Disconnecting socket.');
                newSocket.close();
            };
        }
    }, [user]);

    // Load user credentials from localStorage on boot
    useEffect(() => {
        const savedUser = localStorage.getItem('crm_user');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);



    // Logout handling on 401 response interceptor
    useEffect(() => {
        const responseInterceptor = api.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    console.warn('[AUTH] 401 Unauthorized detected. Logging out.');
                    logout();
                }
                return Promise.reject(error);
            }
        );
        return () => {
            api.interceptors.response.eject(responseInterceptor);
        };
    }, []);

    const login = async (email, password) => {
        try {
            const { data } = await api.post('/auth/login', { email, password });
            setUser(data);
            localStorage.setItem('crm_user', JSON.stringify(data));
            return data;
        } catch (err) {
            console.error('[AUTH] Login failure:', err.response?.data || err.message);
            throw err;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('crm_user');
    };

    const registerSalesUser = async (userData) => {
        const { data } = await api.post('/auth/sales', userData);
        return data;
    };

    const getSalesUsers = async () => {
        const { data } = await api.get('/auth/sales');
        return data;
    };

    const updateSalesUser = async (id, userData) => {
        const { data } = await api.put(`/auth/sales/${id}`, userData);
        return data;
    };

    const deleteSalesUser = async (id) => {
        const { data } = await api.delete(`/auth/sales/${id}`);
        return data;
    };

    const getAdmins = async () => {
        const { data } = await api.get('/auth/admins');
        return data;
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            login,
            logout,
            registerSalesUser,
            getSalesUsers,
            updateSalesUser,
            deleteSalesUser,
            getAdmins,
            whatsAppStatus,
            whatsAppQr,
            setWhatsAppStatus,
            setWhatsAppQr,
            socket,
            api
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
