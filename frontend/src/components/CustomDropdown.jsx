import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function CustomDropdown({
    value,
    onChange,
    options = [],
    placeholder = 'Select option...',
    width = 'auto',
    style = {},
    className = '',
    disabled = false
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [openUp, setOpenUp] = useState(false);
    const dropdownRef = useRef(null);

    // Normalize options into { value, label, icon }
    const normalizedOptions = options.map(opt => {
        if (typeof opt === 'object' && opt !== null) {
            return {
                value: opt.value ?? opt.id ?? '',
                label: opt.label ?? opt.name ?? opt.value ?? '',
                icon: opt.icon,
                badge: opt.badge
            };
        }
        return { value: opt, label: opt };
    });

    const selectedOption = normalizedOptions.find(opt => String(opt.value) === String(value));

    // Smart auto-flip: Detect space in modal or viewport
    useEffect(() => {
        if (isOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            
            // Check if dropdown is inside a modal card
            const modalEl = dropdownRef.current.closest('.modal-card');
            let shouldFlip = false;
            
            if (modalEl) {
                const modalRect = modalEl.getBoundingClientRect();
                const spaceInModalBelow = modalRect.bottom - rect.bottom;
                // If less than 210px remaining inside modal or viewport, open upwards
                if (spaceInModalBelow < 210 || spaceBelow < 220) {
                    shouldFlip = true;
                }
            } else if (spaceBelow < 240 && rect.top > 200) {
                shouldFlip = true;
            }

            setOpenUp(shouldFlip);
        }
    }, [isOpen]);

    // Handle click outside & keyboard escape
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsOpen(false);
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleSelect = (val) => {
        if (onChange) {
            onChange(val);
        }
        setIsOpen(false);
    };

    const isFullWidth = width === '100%';

    return (
        <div 
            ref={dropdownRef} 
            className={`custom-dropdown-container ${isOpen ? 'open' : ''} ${className}`}
            style={{ 
                position: 'relative', 
                width: width || 'auto',
                display: isFullWidth ? 'block' : 'inline-block',
                zIndex: isOpen ? 99999 : 1,
                ...style 
            }}
        >
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`custom-dropdown-trigger ${isOpen ? 'active' : ''}`}
                disabled={disabled}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: isOpen ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '13.5px',
                    fontWeight: 500,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    outline: 'none',
                    boxShadow: isOpen ? '0 0 0 3px rgba(139, 92, 246, 0.22)' : '0 1px 2px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    textAlign: 'left',
                    opacity: disabled ? 0.6 : 1
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedOption?.icon && <span>{selectedOption.icon}</span>}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>
                <ChevronDown 
                    size={16} 
                    style={{ 
                        flexShrink: 0,
                        color: 'var(--text-secondary)',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                    }} 
                />
            </button>

            {isOpen && (
                <div 
                    className={`custom-dropdown-menu ${openUp ? 'animate-dropdown-in-up' : 'animate-dropdown-in'}`}
                    style={{
                        position: 'absolute',
                        top: openUp ? 'auto' : 'calc(100% + 6px)',
                        bottom: openUp ? 'calc(100% + 6px)' : 'auto',
                        left: 0,
                        width: isFullWidth ? '100%' : 'max-content',
                        minWidth: '100%',
                        maxWidth: isFullWidth ? '100%' : '340px',
                        zIndex: 999999,
                        background: '#121420',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '12px',
                        padding: '6px',
                        boxShadow: '0 14px 34px -4px rgba(0, 0, 0, 0.35), 0 6px 14px -3px rgba(0, 0, 0, 0.2)',
                        maxHeight: '210px',
                        overflowY: 'auto'
                    }}
                >
                    {normalizedOptions.map((opt) => {
                        const isSelected = String(opt.value) === String(value);
                        return (
                            <button
                                key={String(opt.value)}
                                type="button"
                                onClick={() => handleSelect(opt.value)}
                                className={`custom-dropdown-item ${isSelected ? 'selected' : ''}`}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '10px',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                                    color: isSelected ? 'var(--accent-color)' : 'var(--text-primary)',
                                    fontWeight: isSelected ? 600 : 400,
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'background 0.15s ease, color 0.15s ease'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {opt.icon && <span>{opt.icon}</span>}
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                                </div>
                                {isSelected && <Check size={14} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
