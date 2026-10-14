import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Plus, Edit2, Trash2, X, Check, Eye, EyeOff, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import CustomDropdown from '../components/CustomDropdown';

const ManageSales = () => {
    const { getSalesUsers, registerSalesUser, updateSalesUser, deleteSalesUser, getAdmins, user } = useAuth();
    const [reps, setReps] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRep, setEditingRep] = useState(null);

    // Form states
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [designation, setDesignation] = useState('');
    const [role, setRole] = useState('sales');
    const [assignedAdmin, setAssignedAdmin] = useState('');
    const [domainEmail, setDomainEmail] = useState('');
    const [mailboxPassword, setMailboxPassword] = useState('');
    const [showMailboxPassword, setShowMailboxPassword] = useState(false);
    const [error, setError] = useState('');

    const fetchReps = async () => {
        try {
            const data = await getSalesUsers();
            setReps(data);
            if (getAdmins) {
                const adminList = await getAdmins();
                setAdmins(adminList || []);
            }
        } catch (err) {
            console.error('[MANAGE SALES] Error fetching reps:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReps();
    }, []);

    const openCreateModal = () => {
        setEditingRep(null);
        setName('');
        setEmail('');
        setPassword('');
        setShowPassword(false);
        setDesignation('Sales Executive');
        setRole('sales');
        setAssignedAdmin(admins.length > 0 ? admins[0]._id : '');
        setDomainEmail('');
        setMailboxPassword('');
        setShowMailboxPassword(false);
        setError('');
        setModalOpen(true);
    };

    const openEditModal = (rep) => {
        setEditingRep(rep);
        setName(rep.name);
        setEmail(rep.email);
        setPassword(''); // Blank by default, only change if entered
        setShowPassword(false);
        setDesignation(rep.designation);
        setRole(rep.role);
        setAssignedAdmin(rep.assignedAdmin?._id || rep.assignedAdmin || '');
        setDomainEmail(rep.domainEmail || rep.email);
        setMailboxPassword('');
        setShowMailboxPassword(false);
        setError('');
        setModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');

        const payload = { 
            name, 
            email, 
            designation, 
            role,
            assignedAdmin: assignedAdmin || undefined,
            domainEmail: domainEmail || email
        };
        if (password) payload.password = password;
        if (mailboxPassword) payload.mailboxPassword = mailboxPassword;

        try {
            if (editingRep) {
                await updateSalesUser(editingRep._id, payload);
            } else {
                if (!password) {
                    setError('Password is required for new accounts.');
                    return;
                }
                payload.password = password;
                await registerSalesUser(payload);
            }
            setModalOpen(false);
            fetchReps();
        } catch (err) {
            setError(err.response?.data?.message || 'Error saving user account.');
        }
    };

    const handleDelete = async (id, repName) => {
        if (window.confirm(`Are you absolutely sure you want to delete ${repName}'s account? This action is permanent.`)) {
            try {
                await deleteSalesUser(id);
                fetchReps();
            } catch (err) {
                console.error('[MANAGE SALES] Error deleting user:', err);
            }
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Loading sales reps accounts...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '6px' }}>Sales Representatives</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage administrative roles, sales accounts, and automated domain mailboxes</p>
                </div>
                <button onClick={openCreateModal} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={18} />
                    <span>Create Rep</span>
                </button>
            </header>

            <div className="glass-panel" style={{ padding: '24px' }}>
                <div className="table-container">
                    <table className="custom-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Login Email</th>
                                <th>Designation</th>
                                <th>Role</th>
                                <th>Supervising Admin</th>
                                <th>Outbound Mailbox</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reps.map((rep) => (
                                <tr key={rep._id}>
                                    <td style={{ fontWeight: 600 }}>{rep.name}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{rep.email}</td>
                                    <td>{rep.designation}</td>
                                    <td>
                                        <span className={`badge ${
                                            rep.role === 'admin' ? 'badge-hot' : 
                                            rep.role === 'mail_pedia' ? 'badge-contacted' : 
                                            'badge-new'
                                        }`} style={rep.role === 'mail_pedia' ? { background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', border: '1px solid rgba(6, 182, 212, 0.3)' } : {}}>
                                            {rep.role === 'mail_pedia' ? 'Mail Pedia' : rep.role}
                                        </span>
                                    </td>
                                    <td>
                                        {rep.assignedAdmin ? (
                                            <span style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                                🛡️ {rep.assignedAdmin.name || 'Admin'}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                                                👑 Master / Direct
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        {rep.role === 'mail_pedia' ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#06b6d4', fontSize: '12px', fontWeight: 600 }}>
                                                <Mail size={13} />
                                                <span>Hostinger Multi-Mailbox Pool</span>
                                            </span>
                                        ) : rep.mailboxConfigured ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '12.5px', fontWeight: 600 }}>
                                                <CheckCircle2 size={14} />
                                                <span style={{ fontFamily: 'monospace' }}>{rep.domainEmail}</span>
                                            </span>
                                        ) : (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '12px' }}>
                                                <AlertCircle size={13} />
                                                <span>{rep.domainEmail || 'Not Configured'}</span>
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'inline-flex', gap: '10px' }}>
                                            <button 
                                                onClick={() => openEditModal(rep)}
                                                className="btn-secondary" 
                                                style={{ padding: '8px 12px', display: 'flex', alignItems: 'center' }}
                                                title="Edit account & mailbox"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(rep._id, rep.name)}
                                                className="btn-secondary" 
                                                style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}
                                                title="Delete representative"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for Create/Edit */}
            {modalOpen && (
                <div className="modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="glass-panel modal-card animate-modal-in" style={{ maxWidth: '540px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '22px', fontWeight: 700 }}>
                                {editingRep ? 'Edit Team Member' : 'Create Team Member'}
                            </h2>
                            <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {error && (
                            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '20px' }}>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Full Name</label>
                                <input type="text" required value={name} onChange={e => setName(e.target.value)} className="form-input" placeholder="e.g. Sarah Jenkins" />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Login Email / Username</label>
                                <input 
                                    type="email" 
                                    required 
                                    value={email} 
                                    onChange={e => {
                                        setEmail(e.target.value);
                                        if (!domainEmail || domainEmail === email) {
                                            setDomainEmail(e.target.value);
                                        }
                                    }} 
                                    className="form-input" 
                                    placeholder="sarah@crm.com" 
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    {editingRep ? 'Login Password (leave blank to keep unchanged)' : 'Account Login Password'}
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required={!editingRep}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="form-input"
                                        placeholder="••••••••"
                                        style={{ paddingRight: '40px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            position: 'absolute',
                                            right: '12px',
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
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Designation</label>
                                    <input type="text" value={designation} onChange={e => setDesignation(e.target.value)} className="form-input" placeholder="e.g. Email Marketer" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>System Role</label>
                                    <CustomDropdown
                                        value={role}
                                        onChange={val => setRole(val)}
                                        options={[
                                            { value: 'sales', label: 'Sales Counselor', icon: '💼' },
                                            { value: 'mail_pedia', label: 'Mail Pedia (Email Marketing)', icon: '📨' },
                                            { value: 'admin', label: 'Administrator', icon: '🛡️' },
                                            { value: 'manager', label: 'Manager', icon: '👑' }
                                        ]}
                                        width="100%"
                                    />
                                </div>
                            </div>

                            {/* Supervising Admin Assignment */}
                            {role !== 'admin' && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                        Supervising Admin (Reports To)
                                    </label>
                                    <CustomDropdown 
                                        value={assignedAdmin} 
                                        onChange={val => setAssignedAdmin(val)}
                                        options={[
                                            { value: '', label: '-- Direct to Master / Organization --' },
                                            ...admins.map(adm => ({
                                                value: adm._id,
                                                label: `${adm.name} (${adm.email}) - ${adm.role}`,
                                                icon: '🛡️'
                                            }))
                                        ]}
                                        width="100%"
                                    />
                                    <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                                        When leads respond as Hot Leads, this Admin and Master receive immediate notification alerts.
                                    </p>
                                </div>
                            )}

                            {/* Mail Pedia vs Sales specific mailbox explanation */}
                            {role === 'mail_pedia' ? (
                                <div style={{
                                    background: 'rgba(6, 182, 212, 0.08)',
                                    border: '1px solid rgba(6, 182, 212, 0.25)',
                                    borderRadius: '10px',
                                    padding: '14px',
                                    fontSize: '12.5px',
                                    color: '#06b6d4'
                                }}>
                                    <p style={{ fontWeight: 700, margin: '0 0 4px 0' }}>📨 Mail Pedia Multi-Mailbox System</p>
                                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                                        This member logs in with this username/password and can add multiple Hostinger webmail accounts in the <strong>Connected Mailboxes</strong> manager for automated campaign rotation.
                                    </p>
                                </div>
                            ) : (
                                /* Domain Mailbox Auto-Provisioning Card for Sales */
                                <div style={{ 
                                    background: 'rgba(99, 102, 241, 0.07)', 
                                    border: '1px solid rgba(99, 102, 241, 0.25)', 
                                    borderRadius: '10px', 
                                    padding: '16px', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '12px' 
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Mail size={16} style={{ color: 'var(--accent-color)' }} />
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                                            Assigned Sales Domain Mailbox
                                        </span>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                            Domain Mailbox Address
                                        </label>
                                        <input 
                                            type="email" 
                                            value={domainEmail} 
                                            onChange={e => setDomainEmail(e.target.value)} 
                                            className="form-input" 
                                            placeholder={email || "e.g. john@yourcompany.com"} 
                                        />
                                    </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                        Gmail App Password / Mailbox Key (Optional)
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type={showMailboxPassword ? "text" : "password"} 
                                            value={mailboxPassword} 
                                            onChange={e => setMailboxPassword(e.target.value)} 
                                            className="form-input" 
                                            placeholder="Leave blank to inherit Organization Master Gmail SMTP" 
                                            style={{ paddingRight: '40px' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowMailboxPassword(!showMailboxPassword)}
                                            style={{
                                                position: 'absolute',
                                                right: '12px',
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
                                            {showMailboxPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '5px 0 0 0', lineHeight: 1.4 }}>
                                        💡 <strong>Zero Setup for Rep:</strong> If left blank, this account automatically inherits your Organization Master Gmail SMTP key so John can send and receive emails immediately upon login.
                                    </p>
                                </div>
                            </div>
                            )}

                            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary" style={{ flexGrow: 1 }}>Cancel</button>
                                <button type="submit" className="btn-primary" style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <Check size={18} />
                                    <span>Save Rep</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageSales;
