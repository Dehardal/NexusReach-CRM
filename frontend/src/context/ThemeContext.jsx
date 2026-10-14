import React, { createContext, useContext, useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('crm_theme');
        return saved === 'light' ? 'light' : 'dark';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('crm_theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isLight: theme === 'light' }}>
            {children}
        </ThemeContext.Provider>
    );
};

// Reusable animated Theme Toggle Button
export const ThemeToggle = ({ style = {}, showLabel = false }) => {
    const { theme, toggleTheme, isLight } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            type="button"
            title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: isLight ? 'rgba(124, 58, 237, 0.08)' : 'rgba(255, 255, 255, 0.08)',
                border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.12)',
                color: isLight ? '#7c3aed' : '#fbbf24',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                ...style
            }}
        >
            {isLight ? <Moon size={16} /> : <Sun size={16} />}
            {showLabel && <span>{isLight ? 'Dark Mode' : 'Light Mode'}</span>}
        </button>
    );
};

export default ThemeContext;
