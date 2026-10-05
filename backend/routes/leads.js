const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const aiService = require('../services/aiService');
const emailService = require('../services/emailService');
const whatsappService = require('../services/whatsappService');

// Multer setup for CSV/Excel file imports
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Helper: Extract column value case-insensitively
const getValue = (row, ...keys) => {
    if (!row || typeof row !== 'object') return undefined;
    const rowKeys = Object.keys(row);
    for (const key of keys) {
        const targetKey = key.toLowerCase().trim();
        let foundKey = rowKeys.find(k => k.toLowerCase().trim() === targetKey);
        
        if (!foundKey) {
            foundKey = rowKeys.find(k => {
                const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                const cleanTarget = targetKey.replace(/[^a-z0-9]/g, '');
                return cleanK === cleanTarget || cleanK.includes(cleanTarget);
            });
        }
        
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
            return String(row[foundKey]).trim();
        }
    }
    return undefined;
};

// @desc    Get all leads with search, status & AI filter
// @route   GET /api/leads
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        // Build query
        const query = { isHidden: false };

        // Role-based visibility
        if (req.user.role === 'sales' || req.user.role === 'mail_pedia') {
            query.assignedTo = req.user._id;
        } else if (req.user.role === 'admin' && !req.query.assignedTo && req.query.scope === 'team') {
            // Admin viewing team leads
            const teamUsers = await User.find({ assignedAdmin: req.user._id }).select('_id');
            const teamUserIds = teamUsers.map(u => u._id);
            teamUserIds.push(req.user._id);
            query.$or = [
                { assignedTo: { $in: teamUserIds } },
                { assignedAdmin: req.user._id }
            ];
        } else if (req.query.assignedTo) {
            if (req.query.assignedTo === 'unassigned') {
                query.$or = [
                    { assignedTo: { $exists: false } },
                    { assignedTo: null }
                ];
            } else {
                query.assignedTo = req.query.assignedTo;
            }
        }

        // Assigned Admin Filter
        if (req.query.assignedAdmin) {
            query.assignedAdmin = req.query.assignedAdmin;
        }

        // Search text
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query.$or = [
                { name: searchRegex },
                { email: searchRegex },
                { phone: searchRegex },
                { course: searchRegex },
                { city: searchRegex }
            ];
        }

        // Status Filter
        if (req.query.status && req.query.status !== 'All') {
            query.status = req.query.status;
        }

        // Campaign Status Filter
        if (req.query.campaignStatus && req.query.campaignStatus !== 'All') {
            query.campaignStatus = req.query.campaignStatus;
        }

        // AI Score Filter
        if (req.query.aiScore && req.query.aiScore !== 'All') {
            query.aiScore = req.query.aiScore;
        }

        // Transferred filter
        if (req.query.isTransferred !== undefined) {
            query.isTransferred = req.query.isTransferred === 'true';
        }

        const total = await Lead.countDocuments(query);
        const leads = await Lead.find(query)
            .populate('assignedTo', 'name email role designation')
            .populate('assignedAdmin', 'name email')
            .populate('transferredTo', 'name email role')
            .populate('transferredFrom', 'name email role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            leads,
            page,
            pages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Create a single lead
// @route   POST /api/leads
// @access  Private
router.post('/', protect, async (req, res) => {
    try {
        const leadData = { ...req.body };
        
        // Auto-assign to current user if sales rep creates it
        if (req.user.role === 'sales') {
            leadData.assignedTo = req.user._id;
        }

        // Perform AI profile analysis
        const aiAnalysis = await aiService.analyzeLeadProfile(leadData);
        leadData.aiScore = aiAnalysis.aiScore;
        leadData.aiSummary = aiAnalysis.aiSummary;

        const lead = await Lead.create(leadData);
        res.status(201).json(lead);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Universal Smart Lead Parser for CSV / Excel rows
const extractSmartLeadFromRow = (row) => {
    if (!row || typeof row !== 'object') return null;

    // 1. Key-based extraction (extensive list of aliases)
    let name = getValue(row, 
        'first_name', 'name', 'full name', 'ad_name', 'lead_name', 'client_name', 
        'customer_name', 'contact_name', 'student_name', 'prospect', 'person', 
        'candidate', 'user', 'full_name', 'title', 'name_of_the_candidate', 'client', 'customer'
    );
    
    let phone = getValue(row, 
        'phone_nu', 'mobile', 'phone', 'contact', 'cell', 'whatsapp', 'number', 
        'phone_number', 'mobile_number', 'contact_number', 'ph_no', 'ph', 
        'mobile_no', 'tel', 'telephone', 'phone_no', 'contact_no', 'primary_phone', 'mobile_num'
    );
    
    let email = getValue(row, 
        'email', 'e-mail', 'email_address', 'mail', 'email_id', 'mail_id', 'e_mail'
    );

    const course = getValue(row, 'course', 'program', 'ad_name', 'subject', 'interest', 'course_name', 'training', 'branch') || '';
    const city = getValue(row, 'city', 'town', 'location', 'district') || '';
    const state = getValue(row, 'state', 'region', 'province') || '';
    const profession = getValue(row, 'profession', 'job', 'title', 'occupation', 'designation', 'work') || '';
    const qualification = getValue(row, 'qualification', 'education', 'degree', 'qualification_details') || '';
    const experience = getValue(row, 'experience', 'exp', 'years', 'total_experience') || '';
    const source = getValue(row, 'source', 'website', 'platform', 'lead_source', 'channel') || 'CSV Import';

    const allValues = Object.values(row).map(v => v !== undefined && v !== null ? String(v).trim() : '').filter(Boolean);

    // 2. Fallback value scanner if phone is missing
    if (!phone) {
        for (const val of allValues) {
            const cleanDigits = val.replace(/\D/g, '');
            if (cleanDigits.length >= 7 && cleanDigits.length <= 15 && !val.includes('@')) {
                phone = val;
                break;
            }
        }
    }

    // 3. Fallback value scanner if email is missing
    if (!email) {
        for (const val of allValues) {
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                email = val;
                break;
            }
        }
    }

    // 4. Fallback text scanner if name is missing
    if (!name) {
        for (const val of allValues) {
            if (val === phone || val === email || val === course || val === city || val === state) continue;
            const lower = val.toLowerCase();
            if (['name', 'phone', 'email', 'mobile', 'course', 'city', 'state', 'status'].includes(lower)) continue;
            
            if (!/^\d+$/.test(val) && val.length >= 2 && val.length <= 60 && !val.includes('@')) {
                name = val;
                break;
            }
        }
    }

    // Fallback name constructing using phone or email
    if (!name && (phone || email)) {
        name = `Lead (${phone || email})`;
    }

    // Skip empty rows with no identifier
    if (!name && !phone && !email) {
        return null;
    }

    return {
        name: name || 'Lead Candidate',
        email: email || '',
        phone: phone || 'N/A',
        course,
        city,
        state,
        profession,
        qualification,
        experience,
        source
    };
};

// @desc    Import leads in batch from CSV or Excel
// @route   POST /api/leads/import
// @access  Private
router.post('/import', protect, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Please upload a CSV or Excel file' });
    }

    try {
        const workbook = xlsx.readFile(req.file.path);
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Uploaded file contains no readable worksheets.' });
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Multi-strategy parsing for standard and title-offset sheets
        let rows = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });

        // Header auto-detection fallback if initial parse yields no keys/data
        if (!rows || rows.length === 0 || !Object.keys(rows[0] || {}).some(k => !k.startsWith('__EMPTY'))) {
            const rawArrayRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
            if (rawArrayRows && rawArrayRows.length > 0) {
                let headerIdx = rawArrayRows.findIndex(r => Array.isArray(r) && r.some(cell => typeof cell === 'string' && cell.trim().length > 0));
                if (headerIdx !== -1 && headerIdx < rawArrayRows.length - 1) {
                    const headers = rawArrayRows[headerIdx].map(h => String(h || '').trim());
                    rows = [];
                    for (let i = headerIdx + 1; i < rawArrayRows.length; i++) {
                        const rowObj = {};
                        const rowArr = rawArrayRows[i];
                        if (Array.isArray(rowArr) && rowArr.some(cell => String(cell || '').trim())) {
                            headers.forEach((h, idx) => {
                                const key = h || `col_${idx}`;
                                rowObj[key] = rowArr[idx] !== undefined ? String(rowArr[idx]).trim() : '';
                            });
                            rows.push(rowObj);
                        }
                    }
                }
            }
        }

        if (!rows || rows.length === 0) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Uploaded spreadsheet is empty or has no readable data rows.' });
        }

        // Validate assignedTo ObjectId if provided
        let assignedToId = null;
        if (req.body.assignedTo && mongoose.Types.ObjectId.isValid(req.body.assignedTo)) {
            assignedToId = req.body.assignedTo;
        }

        const leadsToCreate = [];
        for (const row of rows) {
            const extracted = extractSmartLeadFromRow(row);
            if (!extracted) continue;

            // Use fast heuristics scoring for batch import performance
            const analysis = aiService.runHeuristicsScoring
                ? aiService.runHeuristicsScoring({ name: extracted.name, course: extracted.course, status: 'New' })
                : { aiScore: 'Warm', aiSummary: `Imported lead candidate ${extracted.name}.` };
            
            const lead = {
                name: extracted.name,
                email: extracted.email,
                phone: extracted.phone,
                ageGroup: getValue(row, 'age_requi', 'age group', 'age') || '',
                city: extracted.city,
                state: extracted.state,
                source: extracted.source,
                location: getValue(row, 'location', 'country', 'address') || '',
                profession: extracted.profession,
                qualification: extracted.qualification,
                experience: extracted.experience,
                course: extracted.course,
                status: 'New',
                aiScore: analysis.aiScore || 'Warm',
                aiSummary: analysis.aiSummary || `Imported lead candidate ${extracted.name}`
            };

            if (assignedToId) {
                lead.assignedTo = assignedToId;
            }

            leadsToCreate.push(lead);
        }

        // Clean up uploaded file
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        if (leadsToCreate.length === 0) {
            return res.status(400).json({ 
                message: 'No valid lead data could be extracted. Please check that your file contains data rows.' 
            });
        }

        const createdLeads = await Lead.insertMany(leadsToCreate);

        return res.json({
            message: `Successfully imported ${createdLeads.length} leads!`,
            count: createdLeads.length
        });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        console.error('[LEADS IMPORT ERROR]', error);
        return res.status(500).json({ message: error.message || 'Error importing leads.' });
    }
});

// @desc    Get a single lead details
// @route   GET /api/leads/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id).populate('assignedTo', 'name email');
        if (!lead) return res.status(404).json({ message: 'Lead not found' });
        res.json(lead);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Update a lead
// @route   PUT /api/leads/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
    try {
        let lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: 'Lead not found' });

        // Update fields
        Object.keys(req.body).forEach(key => {
            lead[key] = req.body[key];
        });

        // Trigger scoring update if important fields changed
        if (req.body.course || req.body.profession || req.body.status) {
            const analysis = await aiService.analyzeLeadProfile(lead);
            lead.aiScore = analysis.aiScore;
            lead.aiSummary = analysis.aiSummary;
        }

        const updatedLead = await lead.save();
        res.json(updatedLead);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// @desc    Delete a lead
// @route   DELETE /api/leads/:id
// @access  Private/Master, Admin
router.delete('/:id', protect, authorize('master', 'admin'), async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: 'Lead not found' });

        await lead.deleteOne();
        res.json({ message: 'Lead deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Add a manual note to a lead
// @route   POST /api/leads/:id/notes
// @access  Private
router.post('/:id/notes', protect, async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: 'Lead not found' });

        const note = {
            body: req.body.body,
            author: req.user.name,
            createdAt: new Date()
        };

        lead.notes.push(note);
        await lead.save();
        res.status(201).json(note);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Force re-evaluate AI score and summary
// @route   POST /api/leads/:id/ai-score
// @access  Private
router.post('/:id/ai-score', protect, async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: 'Lead not found' });

        const analysis = await aiService.analyzeLeadProfile(lead);
        lead.aiScore = analysis.aiScore;
        lead.aiSummary = analysis.aiSummary;
        await lead.save();

        res.json({ aiScore: lead.aiScore, aiSummary: lead.aiSummary });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Generate email draft using AI
// @route   POST /api/leads/:id/generate-draft
// @access  Private
router.post('/:id/generate-draft', protect, async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: 'Lead not found' });

        const { type, userPrompt } = req.body;
        const draft = await aiService.generateEmailDraft(lead, type, userPrompt);
        
        // Ensure emailDrafts array is initialized
        if (!Array.isArray(lead.emailDrafts)) {
            lead.emailDrafts = [];
        }

        // Save draft in history
        lead.emailDrafts.push({
            subject: draft.subject || 'Outreach Subject',
            body: draft.body || '',
            category: type || 'outreach',
            createdAt: new Date()
        });
        await lead.save();

        res.json(draft);
    } catch (error) {
        console.error('[GENERATE DRAFT ERROR]', error);
        res.status(500).json({ message: error.message || 'Error generating AI draft' });
    }
});

// @desc    Send custom/drafted email to client
// @route   POST /api/leads/:id/send-email
// @access  Private
router.post('/:id/send-email', protect, async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: 'Lead not found' });
        if (!lead.email) return res.status(400).json({ message: 'Lead does not have an email address' });

        const { subject, body } = req.body;
        await emailService.sendDirectClientEmail(lead.email, subject, body);

        // Record in activity log
        lead.activity.push({
            description: `Sent email outreach: "${subject}"`,
            timestamp: new Date()
        });
        await lead.save();

        res.json({ message: 'Email sent successfully!' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Send live WhatsApp message to client
// @route   POST /api/leads/:id/whatsapp
// @access  Private
router.post('/:id/whatsapp', protect, async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: 'Lead not found' });
        if (!lead.phone) return res.status(400).json({ message: 'Lead does not have a phone number' });

        const { text } = req.body;
        
        // Call whatsapp Web client
        await whatsappService.sendMessage(lead.phone, text);

        // Record message in database
        lead.whatsappMessages.push({
            sender: 'sales',
            text: text,
            timestamp: new Date()
        });
        
        lead.activity.push({
            description: `Sent WhatsApp message: "${text.substring(0, 30)}..."`,
            timestamp: new Date()
        });

        await lead.save();
        res.json({ message: 'WhatsApp message sent successfully!' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Clear all database leads
// @route   DELETE /api/leads/clear-all
// @access  Private (Admin/Master)
router.delete('/clear-all', protect, authorize('admin', 'master'), async (req, res) => {
    try {
        const result = await Lead.deleteMany({});
        res.json({ message: `Successfully deleted all ${result.deletedCount} leads.`, deletedCount: result.deletedCount });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Bulk delete selected leads
// @route   POST /api/leads/bulk-delete
// @access  Private
router.post('/bulk-delete', protect, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'No lead IDs provided for deletion' });
        }

        const result = await Lead.deleteMany({ _id: { $in: ids } });
        res.json({ message: `Successfully deleted ${result.deletedCount} leads.`, deletedCount: result.deletedCount });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Bulk generate AI draft copies for multiple leads
// @route   POST /api/leads/bulk-generate-draft
// @access  Private
router.post('/bulk-generate-draft', protect, async (req, res) => {
    try {
        const { leadIds, type, userPrompt } = req.body;
        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ message: 'No lead IDs specified for draft generation' });
        }

        const leads = await Lead.find({ _id: { $in: leadIds } });
        const results = [];

        for (const lead of leads) {
            try {
                const draft = await aiService.generateEmailDraft(lead, type, userPrompt);
                
                if (!Array.isArray(lead.emailDrafts)) {
                    lead.emailDrafts = [];
                }
                lead.emailDrafts.push({
                    subject: draft.subject || 'Outreach Subject',
                    body: draft.body || '',
                    category: type || 'outreach',
                    createdAt: new Date()
                });
                await lead.save();

                results.push({
                    leadId: lead._id,
                    name: lead.name,
                    email: lead.email,
                    phone: lead.phone,
                    subject: draft.subject || '',
                    body: draft.body || '',
                    whatsappText: draft.whatsappText || draft.body || ''
                });
            } catch (err) {
                console.error(`[BULK AI DRAFT ERROR] Lead ${lead._id}:`, err.message);
                results.push({
                    leadId: lead._id,
                    name: lead.name,
                    email: lead.email,
                    phone: lead.phone,
                    error: err.message
                });
            }
        }

        res.json({ drafts: results });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Bulk assign selected leads to Mail Pedia or Sales member under an Admin
// @route   POST /api/leads/bulk-assign
// @access  Private/Master, Admin
router.post('/bulk-assign', protect, authorize('master', 'admin'), async (req, res) => {
    try {
        const { leadIds, assignedTo, assignedAdmin } = req.body;

        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ message: 'No leads selected for assignment' });
        }

        const targetUser = assignedTo ? await User.findById(assignedTo) : null;
        const targetAdmin = assignedAdmin || (req.user.role === 'admin' ? req.user._id : targetUser?.assignedAdmin || null);

        const updateData = {};
        if (assignedTo !== undefined) {
            updateData.assignedTo = assignedTo || null;
        }
        if (targetAdmin !== undefined) {
            updateData.assignedAdmin = targetAdmin || null;
        }

        const result = await Lead.updateMany(
            { _id: { $in: leadIds } },
            { 
                $set: updateData,
                $push: {
                    activity: {
                        description: `Bulk assigned to ${targetUser ? targetUser.name : 'Unassigned'} by ${req.user.name}`,
                        timestamp: new Date()
                    }
                }
            }
        );

        res.json({
            success: true,
            message: `Successfully allocated ${result.modifiedCount} leads`,
            modifiedCount: result.modifiedCount,
            assignedTo: targetUser ? { _id: targetUser._id, name: targetUser.name, role: targetUser.role } : null
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Chunk Split: Take N leads from unassigned/master database and assign to Mail Pedia / Sales
// @route   POST /api/leads/split-chunk
// @access  Private/Master, Admin
router.post('/split-chunk', protect, authorize('master', 'admin'), async (req, res) => {
    try {
        const { count, assignedTo, assignedAdmin, unassignedOnly = true, statusFilter } = req.body;
        const limitCount = parseInt(count) || 1000;

        if (!assignedTo) {
            return res.status(400).json({ message: 'Target member (Mail Pedia / Sales) must be specified' });
        }

        const targetUser = await User.findById(assignedTo);
        if (!targetUser) {
            return res.status(404).json({ message: 'Target user not found' });
        }

        const targetAdmin = assignedAdmin || (req.user.role === 'admin' ? req.user._id : targetUser.assignedAdmin || null);

        // Build query to pick unassigned or filtered leads
        const query = { isHidden: false };
        if (unassignedOnly) {
            query.$or = [
                { assignedTo: { $exists: false } },
                { assignedTo: null }
            ];
        }

        if (statusFilter && statusFilter !== 'All') {
            query.status = statusFilter;
        }

        // Fetch the IDs of the chunk
        const leadsToAssign = await Lead.find(query)
            .select('_id')
            .sort({ createdAt: 1 })
            .limit(limitCount);

        if (leadsToAssign.length === 0) {
            return res.status(400).json({ message: 'No eligible leads found matching chunk criteria' });
        }

        const leadIds = leadsToAssign.map(l => l._id);

        const result = await Lead.updateMany(
            { _id: { $in: leadIds } },
            {
                $set: {
                    assignedTo: targetUser._id,
                    assignedAdmin: targetAdmin,
                    campaignStatus: 'uncontacted'
                },
                $push: {
                    activity: {
                        description: `Chunk assigned (${leadIds.length} batch) to ${targetUser.name} (${targetUser.role}) by ${req.user.name}`,
                        timestamp: new Date()
                    }
                }
            }
        );

        res.json({
            success: true,
            message: `Allocated ${result.modifiedCount} leads to ${targetUser.name}`,
            allocatedCount: result.modifiedCount,
            assignedTo: {
                _id: targetUser._id,
                name: targetUser.name,
                role: targetUser.role
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Transfer a Hot Responded Lead to a Sales Counselor or Admin
// @route   POST /api/leads/:id/transfer
// @access  Private/Master, Admin
router.post('/:id/transfer', protect, authorize('master', 'admin'), async (req, res) => {
    try {
        const { transferredTo, transferNotes } = req.body;
        const lead = await Lead.findById(req.params.id);

        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }

        const newAssignee = await User.findById(transferredTo);
        if (!newAssignee) {
            return res.status(404).json({ message: 'Selected sales rep or admin not found' });
        }

        const previousAssigneeId = lead.assignedTo;
        const previousUser = previousAssigneeId ? await User.findById(previousAssigneeId) : null;

        lead.transferredFrom = previousAssigneeId || null;
        lead.assignedTo = newAssignee._id;
        lead.transferredTo = newAssignee._id;
        lead.transferredBy = req.user._id;
        lead.transferredAt = new Date();
        lead.isTransferred = true;
        lead.transferNotes = transferNotes || '';
        lead.aiScore = 'Hot'; // Keep hot priority
        if (lead.status === 'New' || lead.status === 'Contacted') {
            lead.status = 'Hot';
        }

        lead.activity.push({
            description: `Transferred from ${previousUser ? previousUser.name : 'Campaign Pool'} to ${newAssignee.name} by ${req.user.name}. Note: ${transferNotes || 'Ready for closing'}`,
            timestamp: new Date()
        });

        await lead.save();

        const populated = await Lead.findById(lead._id)
            .populate('assignedTo', 'name email role designation')
            .populate('transferredTo', 'name email role')
            .populate('transferredFrom', 'name email role');

        // Broadcast real-time Socket.IO notification to the recipient and dashboard
        const io = req.app.get('io');
        if (io) {
            io.emit('hot_lead_transferred', {
                leadId: lead._id,
                leadName: lead.name,
                phone: lead.phone,
                email: lead.email,
                transferredTo: newAssignee._id,
                transferredToName: newAssignee.name,
                transferredByName: req.user.name,
                notes: transferNotes || ''
            });
        }

        res.json({
            success: true,
            message: `Lead transferred to ${newAssignee.name}`,
            lead: populated
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get Hot Leads Queue (Hot/Replied prospects ready for sales transfer)
// @route   GET /api/leads/hot-queue
// @access  Private
router.get('/hot-queue', protect, async (req, res) => {
    try {
        const query = {
            isHidden: false,
            $or: [
                { aiScore: 'Hot' },
                { campaignStatus: 'replied' },
                { status: 'Hot' }
            ]
        };

        if (req.user.role === 'sales') {
            query.assignedTo = req.user._id;
        }

        const hotLeads = await Lead.find(query)
            .populate('assignedTo', 'name email role')
            .populate('assignedAdmin', 'name email')
            .populate('transferredTo', 'name email')
            .populate('transferredFrom', 'name email')
            .sort({ updatedAt: -1 })
            .limit(100);

        res.json(hotLeads);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
