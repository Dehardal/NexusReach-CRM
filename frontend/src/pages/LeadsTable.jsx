import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
    Search, Plus, Upload, Sparkles, MessageSquare, Mail, 
    Calendar, User, PlusCircle, CheckCircle, X, ChevronRight, Send, RefreshCw, PhoneCall, Trash2 
} from 'lucide-react';

const LeadsTable = () => {
    const { api, whatsAppStatus, user, socket, getAdmins } = useAuth();
    const toast = useToast();
    
    // Core states
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);

    // Team members & Admins for allocation & transfer
    const [teamMembers, setTeamMembers] = useState([]);
    const [adminList, setAdminList] = useState([]);

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [aiFilter, setAiFilter] = useState('All');
    const [campaignStatusFilter, setCampaignStatusFilter] = useState('All');
    const [hotQueueOnly, setHotQueueOnly] = useState(false);

    // Bulk Allocation & Chunk Splitter Modals
    const [splitModalOpen, setSplitModalOpen] = useState(false);
    const [splitCount, setSplitCount] = useState(5000);
    const [splitAssignedTo, setSplitAssignedTo] = useState('');
    const [splitAssignedAdmin, setSplitAssignedAdmin] = useState('');
    const [splitSubmitting, setSplitSubmitting] = useState(false);

    const [bulkAssignModalOpen, setBulkAssignModalOpen] = useState(false);
    const [bulkTargetUser, setBulkTargetUser] = useState('');
    const [bulkTargetAdmin, setBulkTargetAdmin] = useState('');
    const [bulkAssignSubmitting, setBulkAssignSubmitting] = useState(false);

    // Hot Lead Transfer Modal
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [leadToTransfer, setLeadToTransfer] = useState(null);
    const [transferToId, setTransferToId] = useState('');
    const [transferNotes, setTransferNotes] = useState('');
    const [transferSubmitting, setTransferSubmitting] = useState(false);

    // Modals & Panels
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Detail Panel Workspace Tabs: 'overview', 'ai', 'whatsapp'
    const [activeTab, setActiveTab] = useState('overview');

    // Forms
    const [leadName, setLeadName] = useState('');
    const [leadEmail, setLeadEmail] = useState('');
    const [leadPhone, setLeadPhone] = useState('');
    const [leadCourse, setLeadCourse] = useState('');
    const [leadProfession, setLeadProfession] = useState('');
    const [leadQualification, setLeadQualification] = useState('');
    const [leadExperience, setLeadExperience] = useState('');
    const [leadCity, setLeadCity] = useState('');
    const [leadState, setLeadState] = useState('');
    const [leadSource, setLeadSource] = useState('');
    const [leadStatus, setLeadStatus] = useState('New');
    const [assignedTo, setAssignedTo] = useState('');

    const [importFile, setImportFile] = useState(null);
    const [importStatus, setImportStatus] = useState('');

    // Detail Workspace Form inputs
    const [newNoteBody, setNewNoteBody] = useState('');
    
    // Follow-up sub-form
    const [followUpDate, setFollowUpDate] = useState('');
    const [followUpTime, setFollowUpTime] = useState('');
    const [followUpNotes, setFollowUpNotes] = useState('');

    // AI Cold Outreach sub-form
    const [aiDraftType, setAiDraftType] = useState('outreach');
    const [aiUserPrompt, setAiUserPrompt] = useState('');
    const [aiDraftSubject, setAiDraftSubject] = useState('');
    const [aiDraftBody, setAiDraftBody] = useState('');
    const [aiWhatsAppText, setAiWhatsAppText] = useState('');
    const [outreachChannel, setOutreachChannel] = useState('both'); // 'email', 'whatsapp', 'both'
    const [aiDraftLoading, setAiDraftLoading] = useState(false);
    const [outreachSending, setOutreachSending] = useState(false);

    // Bulk Selection & Bulk AI Studio States
    const [selectedLeadIds, setSelectedLeadIds] = useState([]);
    const [bulkStudioOpen, setBulkStudioOpen] = useState(false);
    const [bulkDraftType, setBulkDraftType] = useState('outreach');
    const [bulkUserPrompt, setBulkUserPrompt] = useState('');
    const [bulkOutreachChannel, setBulkOutreachChannel] = useState('both');
    const [bulkGenerating, setBulkGenerating] = useState(false);
    const [bulkDrafts, setBulkDrafts] = useState([]);
    const [bulkSending, setBulkSending] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

    // Bulk Handlers
    const handleBulkDelete = async () => {
        if (selectedLeadIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedLeadIds.length} selected leads?`)) return;

        try {
            const { data } = await api.post('/leads/bulk-delete', { ids: selectedLeadIds });
            toast.success(data.message || `Deleted ${selectedLeadIds.length} leads successfully.`);
            setSelectedLeadIds([]);
            fetchLeads();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete selected leads.');
        }
    };

    const handleBulkGenerateDrafts = async () => {
        if (selectedLeadIds.length === 0) return;
        setBulkGenerating(true);
        setBulkDrafts([]);

        try {
            const { data } = await api.post('/leads/bulk-generate-draft', {
                leadIds: selectedLeadIds,
                type: bulkDraftType,
                userPrompt: bulkUserPrompt
            });

            if (data && data.drafts) {
                setBulkDrafts(data.drafts);
                toast.success(`Generated personalized AI drafts for ${data.drafts.length} leads!`);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to generate bulk AI drafts.');
        } finally {
            setBulkGenerating(false);
        }
    };

    const handleBulkDispatch = async () => {
        if (bulkDrafts.length === 0) return;

        const needEmail = bulkOutreachChannel === 'email' || bulkOutreachChannel === 'both';
        const needWhatsApp = bulkOutreachChannel === 'whatsapp' || bulkOutreachChannel === 'both';

        if (needWhatsApp && whatsAppStatus !== 'CONNECTED') {
            toast.error('WhatsApp Web is not linked! Please connect WhatsApp under "WhatsApp Link" in sidebar to send live messages.');
            return;
        }

        setBulkSending(true);
        setBulkProgress({ current: 0, total: bulkDrafts.length });

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < bulkDrafts.length; i++) {
            const draft = bulkDrafts[i];
            setBulkProgress({ current: i + 1, total: bulkDrafts.length });

            let leadSuccess = true;

            if (needEmail && draft.email && draft.subject && draft.body) {
                try {
                    await api.post(`/leads/${draft.leadId}/send-email`, {
                        subject: draft.subject,
                        body: draft.body
                    });
                } catch (err) {
                    leadSuccess = false;
                    console.error(`[BULK DISPATCH] Email error for ${draft.name}:`, err.message);
                }
            }

            if (needWhatsApp && draft.phone && draft.whatsappText) {
                try {
                    await api.post(`/leads/${draft.leadId}/whatsapp`, { text: draft.whatsappText });
                } catch (err) {
                    leadSuccess = false;
                    console.error(`[BULK DISPATCH] WhatsApp error for ${draft.name}:`, err.message);
                }
            }

            if (leadSuccess) successCount++;
            else failCount++;
        }

        setBulkSending(false);
        setBulkStudioOpen(false);
        setSelectedLeadIds([]);
        setBulkDrafts([]);

        if (failCount === 0) {
            toast.success(`Bulk outreach successfully dispatched to all ${successCount} leads!`);
        } else {
            toast.warn(`Bulk dispatch finished: ${successCount} succeeded, ${failCount} failed.`);
        }
        fetchLeads();
    };

    // AI Lead Scraper States
    const [scraperModalOpen, setScraperModalOpen] = useState(false);
    const [scraperMode, setScraperMode] = useState('url'); // 'url' or 'search'
    const [scrapeUrl, setScrapeUrl] = useState('');
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchLocation, setSearchLocation] = useState('Delhi');
    const [directorySource, setDirectorySource] = useState('all');
    const [scraping, setScraping] = useState(false);
    const [scrapedResults, setScrapedResults] = useState([]);
    const [selectedScrapedIndices, setSelectedScrapedIndices] = useState([]);
    const [importingScraped, setImportingScraped] = useState(false);

    const handleRunScraper = async (e) => {
        e?.preventDefault();
        setScraping(true);
        setScrapedResults([]);
        setSelectedScrapedIndices([]);

        try {
            let data;
            if (scraperMode === 'url') {
                if (!scrapeUrl) {
                    toast.error('Please enter a Webpage URL');
                    setScraping(false);
                    return;
                }
                const res = await api.post('/scraper/scrape-url', { url: scrapeUrl });
                data = res.data;
            } else {
                if (!searchKeyword) {
                    toast.error('Please enter an Industry Keyword');
                    setScraping(false);
                    return;
                }
                const res = await api.post('/scraper/search-prospects', {
                    keyword: searchKeyword,
                    location: searchLocation,
                    directorySource
                });
                data = res.data;
            }

            if (data && data.leads) {
                setScrapedResults(data.leads);
                const validIndices = data.leads
                    .map((l, idx) => (!l.alreadyInCrm ? idx : null))
                    .filter(idx => idx !== null);
                setSelectedScrapedIndices(validIndices);

                toast.success(`Found ${data.totalFound} contacts (${data.newLeadsCount} new verified prospects)!`);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Scraper encountered an error extracting leads.');
        } finally {
            setScraping(false);
        }
    };

    const handleImportScrapedLeads = async () => {
        if (selectedScrapedIndices.length === 0) {
            toast.error('No leads selected for import.');
            return;
        }

        setImportingScraped(true);
        try {
            const leadsToImport = selectedScrapedIndices.map(idx => scrapedResults[idx]);
            const { data } = await api.post('/scraper/import-scraped', { leads: leadsToImport });

            toast.success(data.message || `Imported ${data.importedCount} leads successfully!`);
            setScraperModalOpen(false);
            setScrapedResults([]);
            setSelectedScrapedIndices([]);
            fetchLeads();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to import scraped leads.');
        } finally {
            setImportingScraped(false);
        }
    };

    // WhatsApp sub-form
    const [whatsAppText, setWhatsAppText] = useState('');
    const chatEndRef = useRef(null);

    // Load available team accounts and admins to populate assignments
    const [repsList, setRepsList] = useState([]);

    useEffect(() => {
        const fetchTeamData = async () => {
            try {
                const [salesRes, adminRes] = await Promise.all([
                    api.get('/auth/sales'),
                    api.get('/auth/admins')
                ]);
                setRepsList(salesRes.data || []);
                setAdminList(adminRes.data || []);
            } catch (e) {
                console.warn('[LEADS] Error loading team data:', e.message);
            }
        };
        fetchTeamData();
    }, [api]);

    // Socket listener for real-time Hot Lead alerts
    useEffect(() => {
        if (!socket) return;

        const onHotLead = (data) => {
            toast.success(`🔥 HOT LEAD ALERT: ${data.name} replied to outreach!`);
            fetchLeads();
        };

        const onLeadTransferred = (data) => {
            toast.info(`Lead "${data.leadName}" transferred to ${data.transferredToName}`);
            fetchLeads();
        };

        socket.on('hot_lead_alert', onHotLead);
        socket.on('hot_lead_transferred', onLeadTransferred);

        return () => {
            socket.off('hot_lead_alert', onHotLead);
            socket.off('hot_lead_transferred', onLeadTransferred);
        };
    }, [socket]);

    // Fetch Leads from Backend
    const fetchLeads = async () => {
        setLoading(true);
        try {
            const params = {
                page,
                search,
                status: statusFilter,
                aiScore: hotQueueOnly ? 'Hot' : aiFilter,
                campaignStatus: campaignStatusFilter
            };

            const { data } = await api.get('/leads', { params });
            setLeads(data.leads);
            setPages(data.pages);
            setTotal(data.total);
        } catch (err) {
            console.error('[LEADS] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, [page, statusFilter, aiFilter, campaignStatusFilter, hotQueueOnly]);

    // Chunk Split Submit: Master/Admin allocating N leads
    const handleSplitChunk = async (e) => {
        e.preventDefault();
        if (!splitAssignedTo) {
            toast.error('Please select a target team member (Mail Pedia / Sales)');
            return;
        }

        setSplitSubmitting(true);
        try {
            const { data } = await api.post('/leads/split-chunk', {
                count: Number(splitCount) || 1000,
                assignedTo: splitAssignedTo,
                assignedAdmin: splitAssignedAdmin || undefined,
                unassignedOnly: true
            });

            toast.success(data.message || `Allocated ${splitCount} leads successfully!`);
            setSplitModalOpen(false);
            fetchLeads();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to split leads chunk.');
        } finally {
            setSplitSubmitting(false);
        }
    };

    // Bulk Assign Submit for checked checkboxes
    const handleBulkAssign = async (e) => {
        e.preventDefault();
        if (selectedLeadIds.length === 0) return;
        if (!bulkTargetUser) {
            toast.error('Please select an assignee.');
            return;
        }

        setBulkAssignSubmitting(true);
        try {
            const { data } = await api.post('/leads/bulk-assign', {
                leadIds: selectedLeadIds,
                assignedTo: bulkTargetUser,
                assignedAdmin: bulkTargetAdmin || undefined
            });

            toast.success(data.message || `Assigned ${selectedLeadIds.length} leads successfully!`);
            setBulkAssignModalOpen(false);
            setSelectedLeadIds([]);
            fetchLeads();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to assign leads.');
        } finally {
            setBulkAssignSubmitting(false);
        }
    };

    // Hot Lead Transfer to Sales Representative
    const handleTransferLead = async (e) => {
        e.preventDefault();
        if (!leadToTransfer) return;
        if (!transferToId) {
            toast.error('Please select a Sales counselor or Admin to transfer to.');
            return;
        }

        setTransferSubmitting(true);
        try {
            const { data } = await api.post(`/leads/${leadToTransfer._id}/transfer`, {
                transferredTo: transferToId,
                transferNotes
            });

            toast.success(data.message || `Lead transferred successfully!`);
            setTransferModalOpen(false);
            setLeadToTransfer(null);
            setTransferNotes('');
            fetchLeads();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to transfer lead.');
        } finally {
            setTransferSubmitting(false);
        }
    };

    // Trigger search fetch
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setPage(1);
        fetchLeads();
    };

    // Open lead drawer panel
    const openLeadDrawer = async (lead) => {
        setSelectedLead(lead);
        setActiveTab('overview');
        setNewNoteBody('');
        setWhatsAppText('');
        
        // Populate follow-up fields
        if (lead.followUp) {
            setFollowUpDate(lead.followUp.date ? lead.followUp.date.split('T')[0] : '');
            setFollowUpTime(lead.followUp.time || '');
            setFollowUpNotes(lead.followUp.notes || '');
        } else {
            setFollowUpDate('');
            setFollowUpTime('');
            setFollowUpNotes('');
        }

        // Clean AI states
        setAiDraftSubject('');
        setAiDraftBody('');
        setAiUserPrompt('');

        setDrawerOpen(true);
        
        // Auto scroll chat to bottom
        setTimeout(() => {
            if (chatEndRef.current) {
                chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
    };

    // Close drawer
    const closeLeadDrawer = () => {
        setDrawerOpen(false);
        setSelectedLead(null);
    };

    // Create a new lead
    const handleCreateLead = async (e) => {
        e.preventDefault();
        try {
            await api.post('/leads', {
                name: leadName,
                email: leadEmail,
                phone: leadPhone,
                course: leadCourse,
                profession: leadProfession,
                qualification: leadQualification,
                experience: leadExperience,
                city: leadCity,
                state: leadState,
                source: leadSource,
                status: leadStatus,
                assignedTo: assignedTo || undefined
            });
            toast.success('Lead created successfully!');
            setCreateModalOpen(false);
            fetchLeads();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create lead.');
        }
    };

    // Import leads from CSV/Excel
    const handleImportLeads = async (e) => {
        e.preventDefault();
        if (!importFile) return;

        const formData = new FormData();
        formData.append('file', importFile);
        if (assignedTo) formData.append('assignedTo', assignedTo);

        setImportStatus('Processing and scoring leads...');
        try {
            const { data } = await api.post('/leads/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success(data.message);
            setImportModalOpen(false);
            setImportFile(null);
            setImportStatus('');
            fetchLeads();
        } catch (err) {
            setImportStatus('');
            toast.error(err.response?.data?.message || err.message || 'Error importing leads.');
        }
    };

    // Clear all leads from database
    const handleClearAllLeads = async () => {
        if (!window.confirm('Are you sure you want to delete ALL leads from the database? This action cannot be undone.')) {
            return;
        }
        try {
            const { data } = await api.delete('/leads/clear-all');
            toast.success(data.message);
            fetchLeads();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to clear leads.');
        }
    };

    // Save notes
    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!newNoteBody.trim()) return;

        try {
            const { data } = await api.post(`/leads/${selectedLead._id}/notes`, { body: newNoteBody });
            
            // Local update of selected lead
            const updatedNotes = [...selectedLead.notes, data];
            setSelectedLead({ ...selectedLead, notes: updatedNotes });
            setNewNoteBody('');
            toast.success('Note added successfully!');
            
            // Refresh table list silently
            fetchLeads();
        } catch (err) {
            console.error('[DRAWER] Note failed:', err);
            toast.error('Failed to add note.');
        }
    };

    // Save scheduling follow-ups
    const handleSaveFollowUp = async (e) => {
        e.preventDefault();
        try {
            const { data } = await api.put(`/leads/${selectedLead._id}`, {
                followUp: {
                    date: followUpDate || null,
                    time: followUpTime,
                    notes: followUpNotes
                },
                status: 'Follow-up'
            });
            setSelectedLead(data);
            toast.success('Follow-up schedule saved successfully!');
            fetchLeads();
        } catch (err) {
            toast.error('Failed to save follow-up details.');
        }
    };

    // Run AI analysis manually
    const handleRunAIScore = async () => {
        try {
            const { data } = await api.post(`/leads/${selectedLead._id}/ai-score`);
            setSelectedLead({
                ...selectedLead,
                aiScore: data.aiScore,
                aiSummary: data.aiSummary
            });
            toast.success(`AI Scoring updated: ${data.aiScore}`);
            fetchLeads();
        } catch (err) {
            toast.error('Failed to run AI scoring.');
        }
    };

    // Draft cold message using AI
    const handleGenerateAIDraft = async () => {
        setAiDraftLoading(true);
        try {
            const { data } = await api.post(`/leads/${selectedLead._id}/generate-draft`, {
                type: aiDraftType,
                userPrompt: aiUserPrompt
            });
            setAiDraftSubject(data.subject || '');
            setAiDraftBody(data.body || '');
            setAiWhatsAppText(data.whatsappText || data.body || '');
            toast.success('AI Cold Message copy framed!');
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to generate AI cold message.');
        } finally {
            setAiDraftLoading(false);
        }
    };

    // Dispatch outreach via selected channel(s) (Email, WhatsApp, or Both)
    const handleDispatchOutreach = async () => {
        const needEmail = outreachChannel === 'email' || outreachChannel === 'both';
        const needWhatsApp = outreachChannel === 'whatsapp' || outreachChannel === 'both';

        if (needEmail) {
            if (!aiDraftSubject || !aiDraftBody) {
                toast.error('Please generate or enter Email subject and body.');
                return;
            }
            if (!selectedLead.email) {
                toast.error('Lead does not have an email address specified.');
                if (outreachChannel === 'email') return;
            }
        }

        if (needWhatsApp) {
            if (whatsAppStatus !== 'CONNECTED') {
                toast.error('WhatsApp is not linked yet! Please scan the QR code under "WhatsApp Link" in the left sidebar.');
                return;
            }
            if (!aiWhatsAppText) {
                toast.error('Please generate or enter WhatsApp message text.');
                return;
            }
            if (!selectedLead.phone || selectedLead.phone === 'N/A') {
                toast.error('Lead does not have a phone number for WhatsApp.');
                if (outreachChannel === 'whatsapp') return;
            }
        }

        setOutreachSending(true);
        let sentCount = 0;
        let errors = [];

        // 1. Send Email if channel is email or both
        if (needEmail && selectedLead.email) {
            try {
                await api.post(`/leads/${selectedLead._id}/send-email`, {
                    subject: aiDraftSubject,
                    body: aiDraftBody
                });
                sentCount++;
            } catch (err) {
                const msg = typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || err.message);
                errors.push('Email: ' + msg);
            }
        }

        // 2. Send WhatsApp if channel is whatsapp or both
        if (needWhatsApp && selectedLead.phone && selectedLead.phone !== 'N/A') {
            try {
                await api.post(`/leads/${selectedLead._id}/whatsapp`, { text: aiWhatsAppText });
                sentCount++;
                
                const newMsg = { sender: 'sales', text: aiWhatsAppText, timestamp: new Date() };
                const updatedMessages = [...(selectedLead.whatsappMessages || []), newMsg];
                setSelectedLead(prev => prev ? { ...prev, whatsappMessages: updatedMessages } : prev);
            } catch (err) {
                const msg = typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || err.message);
                errors.push('WhatsApp: ' + msg);
            }
        }

        setOutreachSending(false);

        if (errors.length > 0) {
            toast.error(`Dispatch warning: ${errors.join('; ')}`);
        } else if (sentCount > 0) {
            const channelText = outreachChannel === 'both' ? 'Email & WhatsApp' : outreachChannel.toUpperCase();
            toast.success(`Cold message dispatched successfully via ${channelText}!`);
            setAiDraftSubject('');
            setAiDraftBody('');
            setAiWhatsAppText('');
            setAiUserPrompt('');
            fetchLeads();
        }
    };

    // Send WhatsApp message
    const handleSendWhatsApp = async (e) => {
        e.preventDefault();
        if (!whatsAppText.trim()) return;

        try {
            await api.post(`/leads/${selectedLead._id}/whatsapp`, { text: whatsAppText });
            
            // Append message locally for immediate UI update
            const newMsg = {
                sender: 'sales',
                text: whatsAppText,
                timestamp: new Date()
            };
            const updatedMessages = [...(selectedLead.whatsappMessages || []), newMsg];
            setSelectedLead({ ...selectedLead, whatsappMessages: updatedMessages });
            setWhatsAppText('');
            
            // Scroll to bottom
            setTimeout(() => {
                if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }, 100);

            fetchLeads();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send WhatsApp message.');
        }
    };

    return (
        <>
            <div className="animate-fade-in">
            {/* Header controls */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '6px' }}>Leads Workspace</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Organize, bulk assign, analyze, and convert prospect catalogs</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button 
                        onClick={() => setHotQueueOnly(!hotQueueOnly)} 
                        className="btn-secondary" 
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            color: hotQueueOnly ? '#ef4444' : '#f97316', 
                            borderColor: hotQueueOnly ? '#ef4444' : 'rgba(249, 115, 22, 0.4)',
                            background: hotQueueOnly ? 'rgba(239, 68, 68, 0.15)' : 'rgba(249, 115, 22, 0.08)'
                        }}
                    >
                        <span>🔥 {hotQueueOnly ? 'Showing Hot Leads' : 'Hot Leads Queue'}</span>
                    </button>

                    {['master', 'admin'].includes(user?.role) && (
                        <button 
                            onClick={() => {
                                setSplitCount(5000);
                                setSplitAssignedTo(repsList.find(r => r.role === 'mail_pedia')?._id || repsList[0]?._id || '');
                                setSplitAssignedAdmin(adminList[0]?._id || '');
                                setSplitModalOpen(true);
                            }} 
                            className="btn-secondary" 
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#06b6d4', borderColor: 'rgba(6, 182, 212, 0.4)', background: 'rgba(6, 182, 212, 0.08)' }}
                        >
                            <span>⚡ Chunk Allocation (e.g. 5,000)</span>
                        </button>
                    )}

                    <button onClick={() => setScraperModalOpen(true)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a78bfa', borderColor: 'rgba(167, 139, 250, 0.35)' }}>
                        <Sparkles size={16} />
                        <span>🕷️ Scraper</span>
                    </button>
                    <button onClick={() => setImportModalOpen(true)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Upload size={16} />
                        <span>Import</span>
                    </button>
                    <button onClick={() => {
                        setCreateModalOpen(true);
                        setLeadName('');
                        setLeadEmail('');
                        setLeadPhone('');
                        setLeadCourse('');
                        setLeadProfession('');
                        setLeadCity('');
                        setLeadState('');
                        setLeadSource('Direct');
                        setLeadStatus('New');
                    }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={18} />
                        <span>Add Lead</span>
                    </button>
                </div>
            </header>

            {/* Floating Bulk Actions Bar */}
            {selectedLeadIds.length > 0 && (
                <div style={{
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(139, 92, 246, 0.4)',
                    borderRadius: '12px',
                    padding: '12px 20px',
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                        ✓ {selectedLeadIds.length} leads selected
                    </span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {['master', 'admin'].includes(user?.role) && (
                            <button 
                                onClick={() => {
                                    setBulkTargetUser(repsList[0]?._id || '');
                                    setBulkTargetAdmin(adminList[0]?._id || '');
                                    setBulkAssignModalOpen(true);
                                }} 
                                className="btn-primary" 
                                style={{ padding: '8px 14px', fontSize: '13px' }}
                            >
                                Assign Selected to Member
                            </button>
                        )}
                        <button onClick={() => setBulkStudioOpen(true)} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '13px', color: '#a78bfa' }}>
                            AI Cold Outreach Studio
                        </button>
                        <button onClick={handleBulkDelete} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '13px', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>
                            Delete
                        </button>
                    </div>
                </div>
            )}

            {/* Filters panel */}
            <div className="glass-panel" style={{ padding: '20px', marginBottom: '32px' }}>
                <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flexGrow: 1, minWidth: '240px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                        <input 
                            type="text" 
                            value={search} 
                            onChange={e => setSearch(e.target.value)}
                            className="form-input" 
                            placeholder="Search name, phone, course or city..." 
                            style={{ paddingLeft: '44px' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <div>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-input" style={{ width: '140px' }}>
                                <option value="All">All Statuses</option>
                                <option value="New">New</option>
                                <option value="Contacted">Contacted</option>
                                <option value="Follow-up">Follow-up</option>
                                <option value="Won">Won</option>
                                <option value="Lost">Lost</option>
                                <option value="Hot">Hot</option>
                            </select>
                        </div>

                        <div>
                            <select value={aiFilter} onChange={e => setAiFilter(e.target.value)} className="form-input" style={{ width: '130px' }}>
                                <option value="All">All AI Scores</option>
                                <option value="Hot">🔥 Hot</option>
                                <option value="Warm">⚡ Warm</option>
                                <option value="Cold">❄️ Cold</option>
                            </select>
                        </div>

                        <div>
                            <select value={campaignStatusFilter} onChange={e => setCampaignStatusFilter(e.target.value)} className="form-input" style={{ width: '150px' }}>
                                <option value="All">All Outreach</option>
                                <option value="uncontacted">Uncontacted</option>
                                <option value="sent">Campaign Sent</option>
                                <option value="replied">🔥 Replied</option>
                            </select>
                        </div>

                        <button type="submit" className="btn-primary" style={{ padding: '12px 20px' }}>
                            Apply
                        </button>
                    </div>
                </form>
            </div>

            {/* Leads catalog grid panel */}
            <div className="glass-panel" style={{ padding: '24px' }}>
                {loading ? (
                    <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading catalog database...</p>
                ) : leads.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No prospects match the filter settings.</p>
                ) : (
                    <>
                        <div className="table-container">
                            <table className="custom-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px' }}>
                                            <input 
                                                type="checkbox"
                                                checked={leads.length > 0 && selectedLeadIds.length === leads.length}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setSelectedLeadIds(leads.map(l => l._id));
                                                    } else {
                                                        setSelectedLeadIds([]);
                                                    }
                                                }}
                                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                                            />
                                        </th>
                                        <th>Name</th>
                                        <th>AI Priority</th>
                                        <th>Assigned Member</th>
                                        <th>Campaign Status</th>
                                        <th>Contact Info</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leads.map(lead => {
                                        const isSelected = selectedLeadIds.includes(lead._id);
                                        const isHotResponded = lead.aiScore === 'Hot' || lead.campaignStatus === 'replied' || lead.status === 'Hot';

                                        return (
                                            <tr key={lead._id} style={{ background: isSelected ? 'rgba(139, 92, 246, 0.08)' : isHotResponded ? 'rgba(239, 68, 68, 0.04)' : 'transparent' }}>
                                                <td style={{ width: '40px' }}>
                                                    <input 
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={e => {
                                                            if (e.target.checked) {
                                                                setSelectedLeadIds(prev => [...prev, lead._id]);
                                                            } else {
                                                                setSelectedLeadIds(prev => prev.filter(id => id !== lead._id));
                                                            }
                                                        }}
                                                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                                                    />
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{lead.name}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{lead.course || 'Admissions Lead'}</div>
                                                </td>
                                                <td>
                                                    <span className={`badge badge-ai-${(lead.aiScore || 'Cold').toLowerCase()}`}>
                                                        {lead.aiScore === 'Hot' ? '🔥 Hot' : lead.aiScore === 'Warm' ? '⚡ Warm' : '❄️ Cold'}
                                                    </span>
                                                </td>
                                                <td>
                                                    {lead.assignedTo ? (
                                                        <div>
                                                            <span style={{ fontWeight: 600, fontSize: '12.5px' }}>{lead.assignedTo.name}</span>
                                                            <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', textTransform: 'capitalize' }}>
                                                                {lead.assignedTo.role === 'mail_pedia' ? '📨 Mail Pedia' : lead.assignedTo.role}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: '11.5px', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                                                            Unassigned
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span style={{
                                                        fontSize: '11.5px',
                                                        fontWeight: 600,
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        background: lead.campaignStatus === 'replied' ? 'rgba(239, 68, 68, 0.15)' : lead.campaignStatus === 'sent' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255,255,255,0.05)',
                                                        color: lead.campaignStatus === 'replied' ? '#ef4444' : lead.campaignStatus === 'sent' ? '#06b6d4' : 'var(--text-dim)'
                                                    }}>
                                                        {lead.campaignStatus === 'replied' ? '🔥 Replied' : lead.campaignStatus === 'sent' ? '✉️ Sent' : 'Uncontacted'}
                                                    </span>
                                                </td>
                                                <td style={{ color: 'var(--text-secondary)' }}>
                                                    <div>{lead.phone}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{lead.email || 'No email'}</div>
                                                </td>
                                                <td>
                                                    <span className={`badge badge-${(lead.status || 'New').toLowerCase()}`}>
                                                        {lead.status}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                    {/* Master/Admin Transfer Hot Lead to Sales */}
                                                    {['master', 'admin'].includes(user?.role) && isHotResponded && (
                                                        <button 
                                                            onClick={() => {
                                                                setLeadToTransfer(lead);
                                                                const salesReps = repsList.filter(r => r.role === 'sales');
                                                                setTransferToId(salesReps[0]?._id || repsList[0]?._id || '');
                                                                setTransferNotes('');
                                                                setTransferModalOpen(true);
                                                            }}
                                                            className="btn-primary"
                                                            style={{ 
                                                                padding: '6px 12px', 
                                                                fontSize: '12px', 
                                                                background: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)', 
                                                                display: 'inline-flex', 
                                                                alignItems: 'center', 
                                                                gap: '4px', 
                                                                marginRight: '6px' 
                                                            }}
                                                            title="Transfer this Hot Lead to a Sales Counselor"
                                                        >
                                                            <span>🔥 Transfer</span>
                                                        </button>
                                                    )}

                                                    <button onClick={() => openLeadDrawer(lead)} className="btn-secondary" style={{ padding: '8px 12px', display: 'inline-flex', alignItems: 'center' }}>
                                                        <ChevronRight size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination component */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
                                Showing <strong>{leads.length}</strong> of <strong>{total}</strong> active prospects
                            </span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button disabled={page === 1} onClick={() => setPage(page - 1)} className="btn-secondary" style={{ padding: '8px 16px' }}>Prev</button>
                                <button disabled={page === pages} onClick={() => setPage(page + 1)} className="btn-secondary" style={{ padding: '8px 16px' }}>Next</button>
                            </div>
                        </div>
                    </>
                )}
            </div>
            </div>

            {/* Backdrop cover for sliding drawer panel */}
            {drawerOpen && <div className="backdrop" onClick={closeLeadDrawer}></div>}

            {/* Sliding Workspace Drawer */}
            <div className={`detail-drawer ${drawerOpen ? 'open' : ''}`}>
                {selectedLead && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        
                        {/* Title bar info */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ fontSize: '24px', fontWeight: 800 }}>{selectedLead.name}</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginTop: '2px' }}>
                                    {selectedLead.phone} • {selectedLead.email || 'No email'}
                                </p>
                            </div>
                            <button onClick={closeLeadDrawer} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Tabs Navigator */}
                        <div className="tab-header">
                            <button onClick={() => setActiveTab('overview')} className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}>
                                Overview
                            </button>
                            <button onClick={() => setActiveTab('ai')} className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}>
                                ✨ AI Outreach Studio
                            </button>
                            <button onClick={() => setActiveTab('whatsapp')} className={`tab-btn ${activeTab === 'whatsapp' ? 'active' : ''}`}>
                                WhatsApp
                            </button>
                        </div>

                        {/* Tab 1: Overview Panel */}
                        {activeTab === 'overview' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '6px' }}>
                                
                                {/* Info block */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                    <div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Interest Course</div>
                                        <div style={{ fontSize: '14px', fontWeight: 500, marginTop: '2px' }}>{selectedLead.course || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Profession</div>
                                        <div style={{ fontSize: '14px', fontWeight: 500, marginTop: '2px' }}>{selectedLead.profession || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>City & State</div>
                                        <div style={{ fontSize: '14px', fontWeight: 500, marginTop: '2px' }}>
                                            {selectedLead.city ? `${selectedLead.city}, ${selectedLead.state || ''}` : 'N/A'}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Lead Status</div>
                                        <div style={{ marginTop: '4px' }}>
                                            <span className={`badge badge-${(selectedLead.status || 'New').toLowerCase()}`}>
                                                {selectedLead.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Calendar followups scheduler */}
                                <div className="glass-panel" style={{ padding: '16px' }}>
                                    <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Calendar size={16} />
                                        <span>Schedule Follow-up</span>
                                    </h3>
                                    <form onSubmit={handleSaveFollowUp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} className="form-input" />
                                            <input type="time" value={followUpTime} onChange={e => setFollowUpTime(e.target.value)} className="form-input" />
                                        </div>
                                        <textarea value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)} className="form-input" placeholder="Appointment remarks/notes..." style={{ height: '60px', resize: 'none' }}></textarea>
                                        <button type="submit" className="btn-secondary" style={{ width: '100%', padding: '10px' }}>Save Schedule</button>
                                    </form>
                                </div>

                                {/* Notes list section */}
                                <div>
                                    <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Workspace Notes</h3>
                                    <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                        <input 
                                            type="text" 
                                            value={newNoteBody} 
                                            onChange={e => setNewNoteBody(e.target.value)}
                                            className="form-input" 
                                            placeholder="Write a status update note..." 
                                        />
                                        <button type="submit" className="btn-primary" style={{ padding: '0 16px' }}>Add</button>
                                    </form>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {selectedLead.notes && selectedLead.notes.length > 0 ? (
                                            selectedLead.notes.map((note, index) => (
                                                <div key={index} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                    <p style={{ fontSize: '13px' }}>{note.body}</p>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px' }}>
                                                        <span>By: {note.author}</span>
                                                        <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p style={{ fontSize: '12px', color: 'var(--text-dim)', textAlign: 'center' }}>No notes logged for this prospect.</p>
                                        )}
                                    </div>
                                </div>

                            </div>
                        )}

                        {/* Tab 2: AI Cold Outreach Studio */}
                        {activeTab === 'ai' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '6px' }}>
                                
                                {/* AI Insights card */}
                                <div className="glass-panel" style={{ padding: '18px', borderLeft: `4px solid var(--ai-${(selectedLead.aiScore || 'Cold').toLowerCase()})` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <h3 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Sparkles size={16} style={{ color: '#f59e0b' }} />
                                            <span>AI Lead Priority Evaluation</span>
                                        </h3>
                                        <button onClick={handleRunAIScore} className="btn-secondary" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                            <RefreshCw size={12} />
                                            <span>Re-Scout</span>
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                        <span className={`badge badge-ai-${(selectedLead.aiScore || 'Cold').toLowerCase()}`}>
                                            {selectedLead.aiScore} Priority
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: '1.4' }}>
                                        "{selectedLead.aiSummary || 'Run AI scoring to extract candidate profile insights.'}"
                                    </p>
                                </div>

                                {/* AI Cold Message Generator Box */}
                                <div className="glass-panel" style={{ padding: '20px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Sparkles size={16} style={{ color: 'var(--accent-purple)' }} />
                                        <span>Frame Cold Message with AI</span>
                                    </h3>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        {/* Category Preset chips */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Outreach Intent</label>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                {[
                                                    { id: 'outreach', label: '🔥 Cold Introduction' },
                                                    { id: 'pricing', label: '💰 Fee & Package Details' },
                                                    { id: 'followup', label: '📅 Meeting Request' }
                                                ].map(type => (
                                                    <button
                                                        key={type.id}
                                                        type="button"
                                                        onClick={() => setAiDraftType(type.id)}
                                                        style={{
                                                            padding: '6px 12px',
                                                            borderRadius: '20px',
                                                            fontSize: '12px',
                                                            fontWeight: 500,
                                                            cursor: 'pointer',
                                                            border: aiDraftType === type.id ? '1px solid var(--accent-purple)' : '1px solid var(--border-color)',
                                                            background: aiDraftType === type.id ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                                                            color: aiDraftType === type.id ? '#a78bfa' : 'var(--text-secondary)',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                    >
                                                        {type.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Custom Instruction Box */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                                Custom Prompt / Chat Instructions for AI
                                            </label>
                                            <textarea 
                                                value={aiUserPrompt} 
                                                onChange={e => setAiUserPrompt(e.target.value)}
                                                className="form-input" 
                                                placeholder="e.g. Write a friendly cold outreach offering dental clinic management software with 15% inaugural discount..." 
                                                style={{ height: '70px', resize: 'none', fontSize: '13px' }}
                                            />
                                        </div>

                                        <button 
                                            onClick={handleGenerateAIDraft} 
                                            disabled={aiDraftLoading}
                                            className="btn-primary" 
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
                                        >
                                            <Sparkles size={16} />
                                            <span>{aiDraftLoading ? 'AI is framing cold copy...' : 'Frame Cold Message'}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Generated Message Studio & Multi-Channel Dispatcher */}
                                <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)' }}>
                                    <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Send size={16} style={{ color: '#34d399' }} />
                                        <span>Dispatch Channel & Copy Review</span>
                                    </h4>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {/* Channel Options Selector */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Select Sending Channel</label>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                                {[
                                                    { id: 'email', label: '✉️ Email Only', desc: selectedLead.email || 'No email' },
                                                    { id: 'whatsapp', label: '💬 WhatsApp', desc: selectedLead.phone || 'No phone' },
                                                    { id: 'both', label: '🚀 Both (Email + WA)', desc: 'Dual Dispatch' }
                                                ].map(ch => (
                                                    <button
                                                        key={ch.id}
                                                        type="button"
                                                        onClick={() => setOutreachChannel(ch.id)}
                                                        style={{
                                                            padding: '10px 8px',
                                                            borderRadius: '10px',
                                                            fontSize: '12.5px',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            textAlign: 'center',
                                                            border: outreachChannel === ch.id ? '1px solid #34d399' : '1px solid var(--border-color)',
                                                            background: outreachChannel === ch.id ? 'rgba(52, 211, 153, 0.12)' : 'rgba(255,255,255,0.03)',
                                                            color: outreachChannel === ch.id ? '#34d399' : 'var(--text-primary)',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                    >
                                                        <div>{ch.label}</div>
                                                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.desc}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Email Fields (if email or both) */}
                                        {(outreachChannel === 'email' || outreachChannel === 'both') && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Mail size={14} />
                                                    <span>Email Content ({selectedLead.email || 'No email address'})</span>
                                                </div>
                                                <input 
                                                    type="text" 
                                                    value={aiDraftSubject} 
                                                    onChange={e => setAiDraftSubject(e.target.value)}
                                                    className="form-input" 
                                                    placeholder="Email Subject Line" 
                                                    style={{ fontSize: '13px' }}
                                                />
                                                <textarea 
                                                    value={aiDraftBody} 
                                                    onChange={e => setAiDraftBody(e.target.value)}
                                                    className="form-input" 
                                                    placeholder="Email Body Content..."
                                                    style={{ height: '140px', resize: 'vertical', fontSize: '13px', lineHeight: '1.4' }}
                                                />
                                            </div>
                                        )}

                                        {/* WhatsApp Fields (if whatsapp or both) */}
                                        {(outreachChannel === 'whatsapp' || outreachChannel === 'both') && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <MessageSquare size={14} />
                                                        <span>WhatsApp Message ({selectedLead.phone || 'N/A'})</span>
                                                    </div>
                                                    {whatsAppStatus !== 'CONNECTED' && (
                                                        <span style={{ fontSize: '11px', color: '#f87171', background: 'rgba(248,113,113,0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(248,113,113,0.2)' }}>
                                                            ⚠️ Disconnected
                                                        </span>
                                                    )}
                                                </div>
                                                {whatsAppStatus !== 'CONNECTED' && (
                                                    <p style={{ fontSize: '11px', color: '#f87171', margin: 0 }}>
                                                        WhatsApp Web is not linked. Scan QR code under <strong>WhatsApp Link</strong> in the sidebar to enable sending.
                                                    </p>
                                                )}
                                                <textarea 
                                                    value={aiWhatsAppText} 
                                                    onChange={e => setAiWhatsAppText(e.target.value)}
                                                    className="form-input" 
                                                    placeholder="WhatsApp Message Text..."
                                                    style={{ height: '100px', resize: 'vertical', fontSize: '13px', lineHeight: '1.4' }}
                                                />
                                            </div>
                                        )}

                                        {/* Single Send Action Button */}
                                        <button 
                                            onClick={handleDispatchOutreach} 
                                            disabled={outreachSending}
                                            className="btn-primary" 
                                            style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center', 
                                                gap: '8px', 
                                                padding: '12px',
                                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                                                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)',
                                                marginTop: '4px'
                                            }}
                                        >
                                            <Send size={16} />
                                            <span>
                                                {outreachSending 
                                                    ? 'Dispatching outreach message...' 
                                                    : outreachChannel === 'both' 
                                                    ? 'Send via Email & WhatsApp' 
                                                    : outreachChannel === 'email' 
                                                    ? 'Send Email Outreach' 
                                                    : 'Send WhatsApp Message'}
                                            </span>
                                        </button>
                                    </div>
                                </div>

                            </div>
                        )}

                        {/* Tab 3: WhatsApp Chat box */}
                        {activeTab === 'whatsapp' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>
                                
                                {/* WhatsApp linking verification check */}
                                {whatsAppStatus !== 'CONNECTED' ? (
                                    <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                                        <AlertCircleIcon style={{ color: '#f87171', marginBottom: '12px' }} />
                                        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>WhatsApp Connection Required</h3>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px', lineHeight: '1.4' }}>
                                            You must link your personal WhatsApp account via the settings panel before sending messages.
                                        </p>
                                        <a href="/whatsapp-settings" className="btn-secondary" style={{ fontSize: '13px', display: 'inline-block', textDecoration: 'none' }}>
                                            Link Device QR Code
                                        </a>
                                    </div>
                                ) : (
                                    <>
                                        {/* Quick templates outreach bar */}
                                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
                                            <button 
                                                onClick={() => setWhatsAppText(`Hello ${selectedLead.name}, this is PRITS Admissions. We tried calling you. When can we talk?`)}
                                                className="btn-secondary" 
                                                style={{ padding: '6px 12px', fontSize: '11.5px', whiteSpace: 'nowrap' }}
                                            >
                                                ⚡ Request Callback
                                            </button>
                                            <button 
                                                onClick={() => setWhatsAppText(`Hi ${selectedLead.name}, thank you for your interest in the ${selectedLead.course || 'program'} course. Let me know when you are free.`)}
                                                className="btn-secondary" 
                                                style={{ padding: '6px 12px', fontSize: '11.5px', whiteSpace: 'nowrap' }}
                                            >
                                                ⚡ Course Welcome
                                            </button>
                                        </div>

                                        {/* Chat bubble screen panel */}
                                        <div className="chat-window" style={{ flex: 1, minHeight: 0 }}>
                                            <div className="chat-history">
                                                {selectedLead.whatsappMessages && selectedLead.whatsappMessages.length > 0 ? (
                                                    selectedLead.whatsappMessages.map((msg, idx) => (
                                                        <div key={idx} className={`chat-bubble ${msg.sender}`}>
                                                            {msg.text}
                                                            <div style={{ 
                                                                fontSize: '9px', 
                                                                opacity: 0.6, 
                                                                textAlign: 'right', 
                                                                marginTop: '4px',
                                                                color: msg.sender === 'sales' ? '#fff' : 'var(--text-secondary)'
                                                            }}>
                                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
                                                        No WhatsApp messages logged for this lead.
                                                    </div>
                                                )}
                                                <div ref={chatEndRef} />
                                            </div>
                                            
                                            {/* Chat input box */}
                                            <form onSubmit={handleSendWhatsApp} className="chat-input-area">
                                                <input 
                                                    type="text" 
                                                    value={whatsAppText} 
                                                    onChange={e => setWhatsAppText(e.target.value)}
                                                    className="form-input" 
                                                    placeholder="Type a WhatsApp message..." 
                                                    style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                                                />
                                                <button type="submit" className="btn-primary" style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, padding: '0 18px' }}>
                                                    <Send size={16} />
                                                </button>
                                            </form>
                                        </div>
                                    </>
                                )}

                            </div>
                        )}

                    </div>
                )}
            </div>

            {/* Modal: Create Lead Form */}
            {createModalOpen && (
                <div className="modal-overlay" onClick={() => setCreateModalOpen(false)}>
                    <div className="glass-panel modal-card animate-modal-in" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Add New Prospect Lead</h2>
                            <button onClick={() => setCreateModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateLead} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Full Name</label>
                                    <input type="text" required value={leadName} onChange={e => setLeadName(e.target.value)} className="form-input" placeholder="Client Name" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Phone Number</label>
                                    <input type="text" required value={leadPhone} onChange={e => setLeadPhone(e.target.value)} className="form-input" placeholder="e.g. 9876543210" />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Email Address</label>
                                    <input type="email" value={leadEmail} onChange={e => setLeadEmail(e.target.value)} className="form-input" placeholder="name@email.com" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Course Interest</label>
                                    <input type="text" value={leadCourse} onChange={e => setLeadCourse(e.target.value)} className="form-input" placeholder="Digital Marketing" />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Profession</label>
                                    <input type="text" value={leadProfession} onChange={e => setLeadProfession(e.target.value)} className="form-input" placeholder="Student/Job" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Qualification</label>
                                    <input type="text" value={leadQualification} onChange={e => setLeadQualification(e.target.value)} className="form-input" placeholder="B.Tech/MBA" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Experience</label>
                                    <input type="text" value={leadExperience} onChange={e => setLeadExperience(e.target.value)} className="form-input" placeholder="2 Years" />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>City</label>
                                    <input type="text" value={leadCity} onChange={e => setLeadCity(e.target.value)} className="form-input" placeholder="Mumbai" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>State</label>
                                    <input type="text" value={leadState} onChange={e => setLeadState(e.target.value)} className="form-input" placeholder="Maharashtra" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Lead Source</label>
                                    <input type="text" value={leadSource} onChange={e => setLeadSource(e.target.value)} className="form-input" placeholder="Facebook Ad" />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Assign Representative</label>
                                    <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="form-input">
                                        <option value="">-- Select Unassigned --</option>
                                        {repsList.map(r => (
                                            <option key={r._id} value={r._id}>{r.name} ({r.role})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Initial Status</label>
                                    <select value={leadStatus} onChange={e => setLeadStatus(e.target.value)} className="form-input">
                                        <option value="New">New</option>
                                        <option value="Contacted">Contacted</option>
                                        <option value="Follow-up">Follow-up</option>
                                        <option value="Won">Won</option>
                                        <option value="Lost">Lost</option>
                                        <option value="Hot">Hot</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                <button type="button" onClick={() => setCreateModalOpen(false)} className="btn-secondary" style={{ flexGrow: 1 }}>Cancel</button>
                                <button type="submit" className="btn-primary" style={{ flexGrow: 1 }}>Save Lead Candidate</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Import Spreadsheet File */}
            {importModalOpen && (
                <div className="modal-overlay" onClick={() => setImportModalOpen(false)}>
                    <div className="glass-panel modal-card animate-modal-in" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Import Leads Catalog</h2>
                            <button onClick={() => setImportModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleImportLeads} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    Select CSV or Excel Spreadsheet File
                                </label>
                                <input 
                                    type="file" 
                                    required 
                                    accept=".csv, .xlsx, .xls"
                                    onChange={e => setImportFile(e.target.files[0])} 
                                    className="form-input" 
                                    style={{ background: 'rgba(255,255,255,0.02)', padding: '16px' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    Batch Assign to Representative
                                </label>
                                <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="form-input">
                                    <option value="">-- Keep Unassigned --</option>
                                    {repsList.map(r => (
                                        <option key={r._id} value={r._id}>{r.name} ({r.role})</option>
                                    ))}
                                </select>
                            </div>

                            {importStatus && (
                                <p style={{ fontSize: '12.5px', color: 'var(--accent-color)', fontStyle: 'italic' }}>
                                    {importStatus}
                                </p>
                            )}

                            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                <button type="button" onClick={() => setImportModalOpen(false)} className="btn-secondary" style={{ flexGrow: 1 }}>Cancel</button>
                                <button type="submit" disabled={!importFile} className="btn-primary" style={{ flexGrow: 1 }}>
                                    Begin Import
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Floating Bulk Action Bar */}
            {selectedLeadIds.length > 0 && (
                <div style={{
                    position: 'fixed',
                    bottom: '30px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(18, 20, 28, 0.95)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(139, 92, 246, 0.4)',
                    borderRadius: '16px',
                    padding: '12px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(139, 92, 246, 0.2)',
                    zIndex: 1000,
                    animation: 'fadeIn 0.3s ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', color: '#fff' }}>
                        <span style={{ background: 'var(--accent-color)', padding: '2px 10px', borderRadius: '12px', fontSize: '12px' }}>
                            {selectedLeadIds.length}
                        </span>
                        <span>Leads Selected</span>
                    </div>

                    <div style={{ height: '24px', width: '1px', background: 'var(--border-color)' }} />

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button
                            onClick={() => setBulkStudioOpen(true)}
                            className="btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}
                        >
                            <Sparkles size={16} />
                            <span>✨ Bulk AI Studio</span>
                        </button>

                        <button
                            onClick={handleBulkDelete}
                            className="btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                        >
                            <Trash2 size={15} />
                            <span>Delete Selected</span>
                        </button>

                        <button
                            onClick={() => setSelectedLeadIds([])}
                            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, paddingLeft: '8px' }}
                        >
                            Deselect All
                        </button>
                    </div>
                </div>
            )}

            {/* Bulk AI Outreach Studio Modal */}
            {bulkStudioOpen && (
                <div className="modal-overlay">
                    <div className="modal-card animate-modal-in" style={{ width: '780px', maxWidth: '95vw', padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)' }}>
                                    <Sparkles size={22} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Bulk AI Outreach Studio</h3>
                                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                                        Personalize & dispatch AI copy to {selectedLeadIds.length} selected leads
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setBulkStudioOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '18px' }}>
                                ✕
                            </button>
                        </div>

                        {/* Config Controls */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                            {/* Intent Chips */}
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Outreach Goal / Intent Preset</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {[
                                        { id: 'outreach', label: '🔥 Cold Intro Pitch' },
                                        { id: 'pricing', label: '💰 Pricing & Offer' },
                                        { id: 'followup', label: '📅 Follow-up Booking' }
                                    ].map(intent => (
                                        <button
                                            key={intent.id}
                                            type="button"
                                            onClick={() => setBulkDraftType(intent.id)}
                                            style={{
                                                padding: '8px 14px',
                                                borderRadius: '20px',
                                                fontSize: '12.5px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                border: bulkDraftType === intent.id ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                                                background: bulkDraftType === intent.id ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                                                color: bulkDraftType === intent.id ? 'var(--accent-color)' : 'var(--text-secondary)'
                                            }}
                                        >
                                            {intent.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Custom Prompt */}
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>Custom AI Chat Instructions (Optional)</label>
                                <input 
                                    type="text"
                                    value={bulkUserPrompt}
                                    onChange={e => setBulkUserPrompt(e.target.value)}
                                    placeholder="e.g. Highlight our 10% seasonal discount and suggest a 5-minute call..."
                                    className="form-input"
                                />
                            </div>

                            {/* Channel Selector */}
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Sending Channels</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                    {[
                                        { id: 'email', label: '✉️ Email Only' },
                                        { id: 'whatsapp', label: '💬 WhatsApp' },
                                        { id: 'both', label: '🚀 Both (Email + WA)' }
                                    ].map(ch => (
                                        <button
                                            key={ch.id}
                                            type="button"
                                            onClick={() => setBulkOutreachChannel(ch.id)}
                                            style={{
                                                padding: '10px',
                                                borderRadius: '10px',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                textAlign: 'center',
                                                border: bulkOutreachChannel === ch.id ? '1px solid #34d399' : '1px solid var(--border-color)',
                                                background: bulkOutreachChannel === ch.id ? 'rgba(52, 211, 153, 0.12)' : 'rgba(255,255,255,0.03)',
                                                color: bulkOutreachChannel === ch.id ? '#34d399' : 'var(--text-primary)'
                                            }}
                                        >
                                            {ch.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button 
                                onClick={handleBulkGenerateDrafts}
                                disabled={bulkGenerating}
                                className="btn-primary"
                                style={{ padding: '12px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                {bulkGenerating ? (
                                    <>
                                        <RefreshCw size={16} className="spin" style={{ animation: 'spin 2s linear infinite' }} />
                                        <span>Framing personalized copies for {selectedLeadIds.length} leads...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={16} />
                                        <span>✨ Generate AI Copies ({selectedLeadIds.length} Leads)</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Generated Drafts Preview Feed */}
                        {bulkDrafts.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#34d399' }}>
                                        Generated Personalized Copies ({bulkDrafts.length} Prospects)
                                    </h4>
                                </div>

                                <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {bulkDrafts.map((draft, idx) => (
                                        <div key={draft.leadId || idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>{draft.name}</span>
                                                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{draft.phone || draft.email}</span>
                                            </div>
                                            {draft.subject && (
                                                <p style={{ fontSize: '12px', color: '#a78bfa', margin: '0 0 4px', fontWeight: 600 }}>Subject: {draft.subject}</p>
                                            )}
                                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>
                                                {draft.whatsappText || draft.body}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {/* Progress Bar while sending */}
                                {bulkSending && (
                                    <div style={{ marginTop: '10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                                            <span>Dispatching outreach...</span>
                                            <span>{bulkProgress.current} / {bulkProgress.total}</span>
                                        </div>
                                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%`, height: '100%', background: '#34d399', transition: 'width 0.3s ease' }} />
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleBulkDispatch}
                                    disabled={bulkSending}
                                    className="btn-primary"
                                    style={{ padding: '14px', fontSize: '14px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px' }}
                                >
                                    <Send size={18} />
                                    <span>🚀 Dispatch Outreach to {bulkDrafts.length} Leads Now</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Modal: AI Web Lead Scraper & Prospect Finder */}
            {scraperModalOpen && (
                <div className="modal-overlay" onClick={() => setScraperModalOpen(false)}>
                    <div className="glass-panel modal-card animate-modal-in" style={{ width: '850px', maxWidth: '95vw', padding: '32px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(167,139,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>
                                    <Sparkles size={22} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '20px', fontWeight: 800 }}>AI Verified Web Lead Scraper</h3>
                                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                                        Extract clean, verified prospects with 100% Anti-Dummy & Quality Shield protection
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setScraperModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '18px' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Mode Switcher Tabs */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                            <button
                                type="button"
                                onClick={() => setScraperMode('url')}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: scraperMode === 'url' ? '1px solid #a78bfa' : '1px solid var(--border-color)',
                                    background: scraperMode === 'url' ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)',
                                    color: scraperMode === 'url' ? '#a78bfa' : 'var(--text-secondary)'
                                }}
                            >
                                🔗 Scrape from Webpage URL
                            </button>
                            <button
                                type="button"
                                onClick={() => setScraperMode('search')}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: scraperMode === 'search' ? '1px solid #a78bfa' : '1px solid var(--border-color)',
                                    background: scraperMode === 'search' ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)',
                                    color: scraperMode === 'search' ? '#a78bfa' : 'var(--text-secondary)'
                                }}
                            >
                                🔍 Search Business Prospects (Keyword + City)
                            </button>
                        </div>

                        {/* Config Form */}
                        <form onSubmit={handleRunScraper} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                            {scraperMode === 'url' ? (
                                <div>
                                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                        Target Webpage URL
                                    </label>
                                    <input 
                                        type="url"
                                        required
                                        value={scrapeUrl}
                                        onChange={e => setScrapeUrl(e.target.value)}
                                        placeholder="e.g. https://directory-site.com/dental-clinics"
                                        className="form-input"
                                    />
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                            Business Category / Industry Keyword
                                        </label>
                                        <input 
                                            type="text"
                                            required
                                            value={searchKeyword}
                                            onChange={e => setSearchKeyword(e.target.value)}
                                            placeholder="e.g. Dental Clinics, Real Estate Brokers, IT Companies"
                                            className="form-input"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                            Target City / Location
                                        </label>
                                        <input 
                                            type="text"
                                            required
                                            value={searchLocation}
                                            onChange={e => setSearchLocation(e.target.value)}
                                            placeholder="e.g. Delhi, Mumbai, Bangalore"
                                            className="form-input"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                            Directory Engine
                                        </label>
                                        <select value={directorySource} onChange={e => setDirectorySource(e.target.value)} className="form-input">
                                            <option value="all">🌐 All Directories</option>
                                            <option value="google">📍 Google Maps / Places</option>
                                            <option value="indiamart">🏢 IndiaMART B2B</option>
                                            <option value="justdial">📞 JustDial Listings</option>
                                            <option value="yellowpages">📘 YellowPages</option>
                                            <option value="bing">💼 Bing Corporate</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            <button 
                                type="submit" 
                                disabled={scraping}
                                className="btn-primary"
                                style={{ padding: '12px', fontSize: '14px', background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                {scraping ? (
                                    <>
                                        <RefreshCw size={16} className="spin" style={{ animation: 'spin 2s linear infinite' }} />
                                        <span>Extracting webpage content & running Anti-Dummy verification...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={16} />
                                        <span>{scraperMode === 'url' ? '🕷️ Scrape & Verify Webpage Leads' : '🔍 Find & Verify Business Prospects'}</span>
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Scraped Preview Feed */}
                        {scrapedResults.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#34d399' }}>
                                        Extracted Prospects ({scrapedResults.length} Found • {scrapedResults.filter(l => !l.alreadyInCrm).length} New)
                                    </h4>
                                    <button
                                        onClick={() => {
                                            if (selectedScrapedIndices.length === scrapedResults.length) {
                                                setSelectedScrapedIndices([]);
                                            } else {
                                                setSelectedScrapedIndices(scrapedResults.map((_, idx) => idx));
                                            }
                                        }}
                                        style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                    >
                                        {selectedScrapedIndices.length === scrapedResults.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>

                                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {scrapedResults.map((lead, idx) => {
                                        const isChecked = selectedScrapedIndices.includes(idx);
                                        return (
                                            <div 
                                                key={idx}
                                                style={{
                                                    padding: '12px 16px',
                                                    borderRadius: '10px',
                                                    background: lead.alreadyInCrm ? 'rgba(239, 68, 68, 0.06)' : isChecked ? 'rgba(139, 92, 246, 0.12)' : 'rgba(255,255,255,0.02)',
                                                    border: lead.alreadyInCrm ? '1px solid rgba(239, 68, 68, 0.2)' : isChecked ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid var(--border-color)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '12px'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <input 
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        disabled={lead.alreadyInCrm}
                                                        onChange={e => {
                                                            if (e.target.checked) {
                                                                setSelectedScrapedIndices(prev => [...prev, idx]);
                                                            } else {
                                                                setSelectedScrapedIndices(prev => prev.filter(i => i !== idx));
                                                            }
                                                        }}
                                                        style={{ width: '16px', height: '16px', cursor: lead.alreadyInCrm ? 'not-allowed' : 'pointer' }}
                                                    />
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                            <span>{lead.name}</span>
                                                            {lead.website && (
                                                                <a href={lead.website} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#a78bfa', textDecoration: 'none', background: 'rgba(167,139,250,0.12)', padding: '2px 6px', borderRadius: '4px' }}>
                                                                    🌐 Website
                                                                </a>
                                                            )}
                                                            {lead.socialLink && (
                                                                <a href={lead.socialLink} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#38bdf8', textDecoration: 'none', background: 'rgba(56,189,248,0.12)', padding: '2px 6px', borderRadius: '4px' }}>
                                                                    💼 Social Profile
                                                                </a>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                                                            {lead.phone} • {lead.email || 'No email'} • {lead.city}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {lead.website && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setScraperMode('url');
                                                                setScrapeUrl(lead.website);
                                                            }}
                                                            style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#a78bfa', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer' }}
                                                            title="Scrape contact info directly from this website URL"
                                                        >
                                                            🔗 Scrape URL
                                                        </button>
                                                    )}
                                                    {lead.alreadyInCrm ? (
                                                        <span style={{ fontSize: '11px', color: '#f87171', background: 'rgba(248,113,113,0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(248,113,113,0.2)' }}>
                                                            ⚠️ Already in CRM
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontSize: '11px', color: '#34d399', background: 'rgba(52,211,153,0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(52,211,153,0.2)' }}>
                                                            ✨ Verified New
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={handleImportScrapedLeads}
                                    disabled={importingScraped || selectedScrapedIndices.length === 0}
                                    className="btn-primary"
                                    style={{ padding: '14px', fontSize: '14px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}
                                >
                                    <Plus size={18} />
                                    <span>🚀 Import {selectedScrapedIndices.length} Selected Leads to CRM Database</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal: Chunk Splitter for Master & Admin */}
            {splitModalOpen && (
                <div className="modal-overlay" onClick={() => !splitSubmitting && setSplitModalOpen(false)}>
                    <div className="glass-panel modal-card animate-modal-in" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>⚡ Chunk Lead Allocation</h2>
                                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                                    Split database and assign a batch (e.g. 5,000) directly to a member
                                </p>
                            </div>
                            <button onClick={() => setSplitModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSplitChunk} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                                    Batch Size / Number of Leads
                                </label>
                                <input 
                                    type="number" 
                                    required 
                                    min="1" 
                                    value={splitCount} 
                                    onChange={e => setSplitCount(e.target.value)} 
                                    className="form-input" 
                                    placeholder="e.g. 5000" 
                                />
                                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                    Picks unassigned leads from the master catalog in order.
                                </span>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                                    Assign Directly To Member
                                </label>
                                <select 
                                    required 
                                    value={splitAssignedTo} 
                                    onChange={e => setSplitAssignedTo(e.target.value)} 
                                    className="form-input"
                                >
                                    <option value="">-- Select Member --</option>
                                    {repsList.map(rep => (
                                        <option key={rep._id} value={rep._id}>
                                            {rep.role === 'mail_pedia' ? '📨' : '💼'} {rep.name} ({rep.role === 'mail_pedia' ? 'Mail Pedia' : rep.role})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                                    Supervising Admin (Gets Hot Lead Notifications)
                                </label>
                                <select 
                                    value={splitAssignedAdmin} 
                                    onChange={e => setSplitAssignedAdmin(e.target.value)} 
                                    className="form-input"
                                >
                                    <option value="">-- Direct under Master --</option>
                                    {adminList.map(adm => (
                                        <option key={adm._id} value={adm._id}>
                                            🛡️ {adm.name} ({adm.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                                <button type="button" onClick={() => setSplitModalOpen(false)} className="btn-secondary" disabled={splitSubmitting}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={splitSubmitting || !splitAssignedTo} style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' }}>
                                    <span>{splitSubmitting ? 'Splitting & Allocating...' : `Confirm Allocation of ${splitCount} Leads`}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Bulk Assign Selected Checkboxes */}
            {bulkAssignModalOpen && (
                <div className="modal-overlay" onClick={() => !bulkAssignSubmitting && setBulkAssignModalOpen(false)}>
                    <div className="glass-panel modal-card animate-modal-in" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Assign {selectedLeadIds.length} Selected Leads</h2>
                                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                                    Delegate selected leads to a Mail Pedia marketer or Sales counselor
                                </p>
                            </div>
                            <button onClick={() => setBulkAssignModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleBulkAssign} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Assignee</label>
                                <select 
                                    required 
                                    value={bulkTargetUser} 
                                    onChange={e => setBulkTargetUser(e.target.value)} 
                                    className="form-input"
                                >
                                    <option value="">-- Choose Member --</option>
                                    {repsList.map(rep => (
                                        <option key={rep._id} value={rep._id}>
                                            {rep.role === 'mail_pedia' ? '📨' : '💼'} {rep.name} ({rep.role === 'mail_pedia' ? 'Mail Pedia' : rep.role})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Supervising Admin</label>
                                <select 
                                    value={bulkTargetAdmin} 
                                    onChange={e => setBulkTargetAdmin(e.target.value)} 
                                    className="form-input"
                                >
                                    <option value="">-- Default / Direct under Master --</option>
                                    {adminList.map(adm => (
                                        <option key={adm._id} value={adm._id}>
                                            🛡️ {adm.name} ({adm.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                                <button type="button" onClick={() => setBulkAssignModalOpen(false)} className="btn-secondary" disabled={bulkAssignSubmitting}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={bulkAssignSubmitting || !bulkTargetUser}>
                                    <span>{bulkAssignSubmitting ? 'Assigning...' : `Assign ${selectedLeadIds.length} Leads`}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Transfer Hot Lead to Sales Closer */}
            {transferModalOpen && leadToTransfer && (
                <div className="modal-overlay" onClick={() => !transferSubmitting && setTransferModalOpen(false)}>
                    <div className="glass-panel modal-card animate-modal-in" style={{ maxWidth: '540px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#f97316' }}>🔥 Transfer Hot Lead to Closer</h2>
                                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                                    Hand over this responded lead to an Admissions Counselor or Admin
                                </p>
                            </div>
                            <button onClick={() => setTransferModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                ✕
                            </button>
                        </div>

                        {/* Lead Snapshot */}
                        <div style={{ background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.25)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>{leadToTransfer.name}</span>
                                <span style={{ fontSize: '11px', background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                                    🔥 HOT RESPONDED
                                </span>
                            </div>
                            <p style={{ margin: '0 0 4px 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                                📞 {leadToTransfer.phone} • ✉️ {leadToTransfer.email || 'No email'}
                            </p>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim)' }}>
                                Program: <strong>{leadToTransfer.course || 'Admissions Program'}</strong>
                            </p>
                        </div>

                        <form onSubmit={handleTransferLead} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                                    Transfer To Sales Counselor or Admin
                                </label>
                                <select 
                                    required 
                                    value={transferToId} 
                                    onChange={e => setTransferToId(e.target.value)} 
                                    className="form-input"
                                >
                                    <option value="">-- Select Closer --</option>
                                    <optgroup label="Sales Counselors">
                                        {repsList.filter(r => r.role === 'sales').map(r => (
                                            <option key={r._id} value={r._id}>
                                                💼 {r.name} ({r.email}) - {r.designation || 'Sales Rep'}
                                            </option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="Administrators">
                                        {adminList.map(a => (
                                            <option key={a._id} value={a._id}>
                                                🛡️ {a.name} ({a.email}) - {a.role}
                                            </option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                                    Handover Notes / Instructions for Sales Closer
                                </label>
                                <textarea 
                                    rows={3} 
                                    value={transferNotes} 
                                    onChange={e => setTransferNotes(e.target.value)} 
                                    className="form-input" 
                                    placeholder="e.g. Prospect showed interest in MBA brochure, reach out via WhatsApp template today"
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                                <button type="button" onClick={() => setTransferModalOpen(false)} className="btn-secondary" disabled={transferSubmitting}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={transferSubmitting || !transferToId} style={{ background: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)' }}>
                                    <span>{transferSubmitting ? 'Transferring...' : '🚀 Complete Handover to Sales'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </>
    );
};

// Local Icon Helper since standard Lucide package may differ
const AlertCircleIcon = (props) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="40" 
        height="40" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        {...props}
    >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
);

export default LeadsTable;
