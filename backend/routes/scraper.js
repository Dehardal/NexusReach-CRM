const express = require('express');
const router = express.Router();
const axios = require('axios');
const Lead = require('../models/Lead');
const { protect } = require('../middleware/auth');

// Anti-Dummy Regex & Filtering Helpers
const DUMMY_PHONES = [
    '0000000000', '1234567890', '9876543210', '9999999999', 
    '1111111111', '2222222222', '3333333333', '4444444444', 
    '5555555555', '6666666666', '7777777777', '8888888888'
];

const DUMMY_EMAIL_KEYWORDS = [
    'example.com', 'domain.com', 'email.com', 'test.com', 'sample.com',
    'yourname', 'username', 'noreply', 'no-reply', 'sentry', 'cloudflare', 'wixpress',
    'duckduckgo.com', 'duckduckgo', 'error-lite'
];

const JUNK_NAMES = [
    'home', 'contact us', 'about us', 'privacy policy', 'terms of service',
    'click here', 'read more', 'learn more', 'copyright', 'all rights reserved',
    'facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'whatsapp',
    'duckduckgo', 'google', 'bing', 'yahoo', 'search results', 'sponsored', 'map', 'directions',
    'category', 'wikipedia', 'wikimedia', 'list of', 'portal', 'main page'
];

// Industry Keyword Synonym Map
const SYNONYM_MAP = {
    realtor: ['realtor', 'real estate', 'realty', 'property consultant', 'real estate agent', 'property broker', 'builder'],
    realstate: ['real estate', 'realtor', 'realty', 'property broker', 'builder'],
    realestate: ['real estate', 'realtor', 'realty', 'property broker', 'builder'],
    saloon: ['salon', 'saloon', 'beauty parlour', 'hair studio', 'spa', 'hairdresser'],
    salon: ['salon', 'saloon', 'beauty parlour', 'hair studio', 'spa', 'hairdresser'],
    spa: ['spa', 'wellness center', 'massage parlor', 'beauty spa', 'salon'],
    clinic: ['clinic', 'medical clinic', 'doctor', 'healthcare', 'hospital', 'polyclinic'],
    medical: ['medical clinic', 'pharmacy', 'chemist', 'doctor', 'hospital', 'clinic'],
    repairing: ['repair service', 'repair shop', 'repair center', 'maintenance service'],
    repair: ['repair service', 'repair shop', 'repair center', 'service center'],
    painting: ['painting contractor', 'painter', 'home painting', 'decorating service'],
    logistics: ['logistics company', 'transporters', 'freight services', 'courier service', 'cargo'],
    dairy: ['dairy farm', 'dairy products', 'milk supplier', 'dairy business'],
    bookstore: ['bookstore', 'book shop', 'stationery', 'bookseller', 'publishers'],
    automobile: ['automobile', 'car dealer', 'auto repair', 'garage', 'car showroom', 'auto parts'],
    gym: ['fitness center', 'gym', 'health club', 'workout center'],
    hotel: ['hotel', 'resort', 'guest house', 'lodging', 'homestay'],
    restaurant: ['restaurant', 'cafe', 'diner', 'eatery', 'bistro', 'food court'],
    coaching: ['coaching institute', 'tuition center', 'training institute', 'academy', 'classes'],
    it: ['it company', 'software company', 'tech agency', 'web development', 'digital marketing']
};

const getSynonyms = (inputKeyword) => {
    const raw = (inputKeyword || '').trim();
    if (!raw) return ['business'];
    const clean = raw.toLowerCase().replace(/[\s-_]+/g, '');
    
    for (const key in SYNONYM_MAP) {
        if (clean.includes(key) || key.includes(clean)) {
            return SYNONYM_MAP[key];
        }
    }

    return [
        raw,
        `${raw} services`,
        `${raw} company`,
        `${raw} business`,
        `${raw} agency`,
        `${raw} shop`,
        `${raw} center`
    ];
};

const normalizeCity = (cityStr) => {
    if (!cityStr) return 'Delhi';
    const trimmed = cityStr.trim().replace(/\s+/g, ' ');
    const lower = trimmed.toLowerCase();
    
    if (lower.includes('beangaluru') || lower.includes('bangalore') || lower.includes('bengaluru')) return 'Bengaluru';
    if (lower.includes('nyc') || lower.includes('new york')) return 'New York';

    return trimmed.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

const isValidPhone = (phoneStr) => {
    if (!phoneStr || phoneStr === 'N/A') return false;
    const clean = phoneStr.replace(/\D/g, '');
    if (clean.length < 10 || clean.length > 13) return false;
    const last10 = clean.slice(-10);
    if (DUMMY_PHONES.includes(last10)) return false;
    if (/^(\d)\1{9}$/.test(last10)) return false;
    if (clean.startsWith('1786') || clean.startsWith('178')) return false;
    return true;
};

const isValidEmail = (emailStr) => {
    if (!emailStr) return false;
    const lower = emailStr.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) return false;
    for (const kw of DUMMY_EMAIL_KEYWORDS) {
        if (lower.includes(kw)) return false;
    }
    return true;
};

const isValidRealBusinessUrl = (urlStr) => {
    if (!urlStr) return false;
    const lower = urlStr.toLowerCase().trim();
    if (
        lower.includes('google.com') || lower.includes('duckduckgo.com') ||
        lower.includes('bing.com') || lower.includes('yahoo.com') ||
        lower.includes('wikipedia.org') || lower.includes('wikimedia.org') ||
        lower.includes('openstreetmap.org') || lower.includes('search?')
    ) {
        return false;
    }
    return lower.startsWith('http://') || lower.startsWith('https://') || lower.includes('.com') || lower.includes('.in') || lower.includes('.org') || lower.includes('.net');
};

const cleanName = (nameStr) => {
    if (!nameStr) return 'Scraped Prospect';
    const trimmed = nameStr.trim().replace(/\s+/g, ' ');
    if (trimmed.length < 3) return 'Scraped Prospect';
    if (JUNK_NAMES.includes(trimmed.toLowerCase())) return 'Scraped Prospect';
    return trimmed;
};

// Pure JS HTML Parser Helpers
const extractTitle = (html) => {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (match && match[1]) {
        return match[1].replace(/<[^>]+>/g, '').split('|')[0].split('-')[0].trim();
    }
    return 'Web Lead';
};

const extractMailtoLinks = (html) => {
    const matches = html.match(/href=["']mailto:([^"'\s?]+)/gi) || [];
    const emails = [];
    matches.forEach(m => {
        const clean = m.replace(/href=["']mailto:/i, '').split('?')[0].split('"')[0].split("'")[0].trim();
        if (isValidEmail(clean) && !emails.includes(clean.toLowerCase())) {
            emails.push(clean.toLowerCase());
        }
    });
    return emails;
};

const extractTelLinks = (html) => {
    const matches = html.match(/href=["']tel:([^"'\s?]+)/gi) || [];
    const phones = [];
    matches.forEach(m => {
        const clean = m.replace(/href=["']tel:/i, '').split('?')[0].split('"')[0].split("'")[0].trim();
        if (isValidPhone(clean) && !phones.includes(clean)) {
            phones.push(clean);
        }
    });
    return phones;
};

const extractPageText = (html) => {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ');
};

const GLOBAL_PHONE_REGEX = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b|\b[1-9]\d{9,11}\b/g;
const GLOBAL_EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Deep Business Website & Contact Resolver (Only parses snippet blocks, ignores DuckDuckGo page scripts)
const resolveAndEnrichBusiness = async (businessName, city) => {
    try {
        const searchQuery = `"${businessName}" "${city}" contact phone website`;
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

        const response = await axios.get(searchUrl, {
            timeout: 6000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            }
        });

        const html = response.data || '';
        
        let phone = 'N/A';
        let email = '';

        // Extract phone and email strictly from search snippet blocks
        const snippetBlocks = html.split(/class="result__snippet"/i);
        for (let i = 1; i < snippetBlocks.length; i++) {
            const snippetText = snippetBlocks[i].split('</div>')[0].replace(/<[^>]+>/g, ' ');
            const foundP = (snippetText.match(GLOBAL_PHONE_REGEX) || []).find(isValidPhone);
            const foundE = (snippetText.match(GLOBAL_EMAIL_REGEX) || []).find(isValidEmail);

            if (foundP && phone === 'N/A') phone = foundP;
            if (foundE && !email) email = foundE;
        }

        // Extract real business domain from search results
        const urlMatches = html.match(/class="result__url"[^>]*href=["']([^"'\s]+)/gi) || [];
        let realWebsite = '';

        for (const m of urlMatches) {
            let rawUrl = m.replace(/class="result__url"[^>]*href=["']/i, '').split('"')[0].split("'")[0].trim();
            if (rawUrl.includes('uddg=')) {
                try {
                    const parsedUrl = new URL(rawUrl);
                    const actualTarget = parsedUrl.searchParams.get('uddg');
                    if (actualTarget) rawUrl = actualTarget;
                } catch (e) {}
            }
            if (isValidRealBusinessUrl(rawUrl)) {
                realWebsite = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
                break;
            }
        }

        // Deep fetch on the actual business website homepage if found
        if (realWebsite) {
            try {
                const siteRes = await axios.get(realWebsite, {
                    timeout: 6000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                    }
                });

                const siteHtml = siteRes.data || '';
                const siteText = extractPageText(siteHtml);

                if (phone === 'N/A') {
                    const telLink = extractTelLinks(siteHtml)[0];
                    const foundP = telLink || (siteText.match(GLOBAL_PHONE_REGEX) || []).find(isValidPhone);
                    if (foundP) phone = foundP;
                }

                if (!email) {
                    const mailLink = extractMailtoLinks(siteHtml)[0];
                    const foundE = mailLink || (siteText.match(GLOBAL_EMAIL_REGEX) || []).find(isValidEmail);
                    if (foundE) email = foundE;
                }
            } catch (siteErr) {
                // Ignore website timeout
            }
        }

        return {
            realWebsite,
            phone,
            email
        };

    } catch (err) {
        return { realWebsite: '', phone: 'N/A', email: '' };
    }
};

// @desc    Scrape leads directly from a Webpage URL
// @route   POST /api/scraper/scrape-url
// @access  Private
router.post('/scrape-url', protect, async (req, res) => {
    try {
        let { url } = req.body;
        if (!url) return res.status(400).json({ message: 'Please provide a valid Webpage URL' });

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        console.log(`[SCRAPER] Fetching URL: ${url}`);

        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        const html = response.data || '';
        const pageTitle = extractTitle(html);
        const mailtoLinks = extractMailtoLinks(html);
        const telLinks = extractTelLinks(html);
        const pageText = extractPageText(html);

        const linkedinMatch = (html.match(/https?:\/\/(?:www\.)?linkedin\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/gi) || [])[0] || '';
        const instaMatch = (html.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/gi) || [])[0] || '';
        const fbMatch = (html.match(/https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9_.]+/gi) || [])[0] || '';

        const foundEmails = pageText.match(GLOBAL_EMAIL_REGEX) || [];
        foundEmails.forEach(e => {
            if (isValidEmail(e) && !mailtoLinks.includes(e.toLowerCase())) {
                mailtoLinks.push(e.toLowerCase());
            }
        });

        const foundPhones = pageText.match(GLOBAL_PHONE_REGEX) || [];
        foundPhones.forEach(p => {
            if (isValidPhone(p) && !telLinks.includes(p)) {
                telLinks.push(p);
            }
        });

        const scrapedLeads = [];
        const processedPhones = new Set();
        const maxCount = Math.max(telLinks.length, mailtoLinks.length, 1);

        for (let i = 0; i < Math.min(maxCount, 35); i++) {
            const phoneVal = telLinks[i] || 'N/A';
            const emailVal = mailtoLinks[i] || '';
            const socialVal = linkedinMatch || instaMatch || fbMatch;
            
            if (phoneVal !== 'N/A' || emailVal || url || socialVal) {
                const phoneKey = phoneVal !== 'N/A' ? phoneVal.replace(/\D/g, '').slice(-10) : '';
                if (!phoneKey || !processedPhones.has(phoneKey)) {
                    if (phoneKey) processedPhones.add(phoneKey);
                    scrapedLeads.push({
                        name: maxCount === 1 ? pageTitle : `${pageTitle} #${i + 1}`,
                        phone: phoneVal,
                        email: emailVal,
                        website: isValidRealBusinessUrl(url) ? url : '',
                        socialLink: socialVal,
                        city: 'Extracted from Web',
                        course: 'Sales Inquiry',
                        source: `Web Scraper (${new URL(url).hostname})`
                    });
                }
            }
        }

        // Deduplication Check
        const existingLeads = await Lead.find({}, 'phone email');
        const existingPhoneSet = new Set(existingLeads.map(l => (l.phone || '').replace(/\D/g, '').slice(-10)).filter(Boolean));
        const existingEmailSet = new Set(existingLeads.map(l => (l.email || '').toLowerCase()).filter(Boolean));

        const verifiedLeads = scrapedLeads.map(lead => {
            const cleanP = (lead.phone || '').replace(/\D/g, '').slice(-10);
            const cleanE = (lead.email || '').toLowerCase();
            const alreadyInCrm = (cleanP && existingPhoneSet.has(cleanP)) || (cleanE && existingEmailSet.has(cleanE));
            return {
                ...lead,
                alreadyInCrm: !!alreadyInCrm
            };
        });

        res.json({
            url,
            totalFound: verifiedLeads.length,
            newLeadsCount: verifiedLeads.filter(l => !l.alreadyInCrm).length,
            leads: verifiedLeads
        });

    } catch (error) {
        console.error('[SCRAPER ERROR]', error);
        res.status(500).json({ message: error.message || 'Failed to scrape webpage content.' });
    }
});

// @desc    Smart Prospect Search with Deep Real-Website & Contact Resolver
// @route   POST /api/scraper/search-prospects
// @access  Private
router.post('/search-prospects', protect, async (req, res) => {
    try {
        const { keyword, location, directorySource } = req.body;
        if (!keyword) return res.status(400).json({ message: 'Please provide a business category or keyword' });

        const targetCity = normalizeCity(location);
        const synonyms = getSynonyms(keyword);

        console.log(`[DEEP PROSPECT SEARCH] Keyword: '${keyword}' -> Synonyms: [${synonyms.join(', ')}], City: '${targetCity}'`);

        const discoveredRawLeads = [];
        const processedNames = new Set();

        // 1. Fetch raw business prospects from OpenStreetMap Places API
        for (const term of synonyms.slice(0, 3)) {
            try {
                const query = `${term}, ${targetCity}`;
                const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&extratags=1&limit=25`;
                
                const response = await axios.get(osmUrl, {
                    timeout: 7000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0' }
                });

                if (Array.isArray(response.data)) {
                    response.data.forEach(item => {
                        const rawName = item.display_name.split(',')[0].trim();
                        const tags = item.extratags || {};
                        const phone = tags.phone || tags['contact:phone'] || tags['phone:mobile'] || '';
                        const email = tags.email || tags['contact:email'] || '';
                        const website = tags.website || tags['contact:website'] || tags['url'] || '';

                        const validName = cleanName(rawName);
                        if (validName !== 'Scraped Prospect' && validName.length > 2 && !processedNames.has(validName.toLowerCase())) {
                            processedNames.add(validName.toLowerCase());
                            discoveredRawLeads.push({
                                name: validName,
                                phone: isValidPhone(phone) ? phone : 'N/A',
                                email: isValidEmail(email) ? email : '',
                                website: isValidRealBusinessUrl(website) ? (website.startsWith('http') ? website : `https://${website}`) : '',
                                city: item.address?.city || item.address?.town || item.address?.suburb || targetCity,
                                course: keyword
                            });
                        }
                    });
                }
            } catch (err) {}
        }

        // 2. Deep Parallel Resolution & Contact Enrichment for Discovered Prospects
        console.log(`[DEEP ENRICHMENT] Resolving real websites & phone/email for ${discoveredRawLeads.length} prospects...`);

        const enrichedLeads = await Promise.all(
            discoveredRawLeads.slice(0, 12).map(async (rawLead) => {
                if (rawLead.phone !== 'N/A' && rawLead.website) {
                    return rawLead;
                }

                const enrichment = await resolveAndEnrichBusiness(rawLead.name, targetCity);

                return {
                    ...rawLead,
                    website: rawLead.website || enrichment.realWebsite,
                    phone: rawLead.phone !== 'N/A' ? rawLead.phone : enrichment.phone,
                    email: rawLead.email || enrichment.email,
                    source: `Verified Business (${keyword})`
                };
            })
        );

        // Deduplication Check with existing MongoDB Leads
        const existingLeads = await Lead.find({}, 'phone email');
        const existingPhoneSet = new Set(existingLeads.map(l => (l.phone || '').replace(/\D/g, '').slice(-10)).filter(Boolean));
        const existingEmailSet = new Set(existingLeads.map(l => (l.email || '').toLowerCase()).filter(Boolean));

        const verifiedLeads = enrichedLeads.map(lead => {
            const cleanP = (lead.phone || '').replace(/\D/g, '').slice(-10);
            const cleanE = (lead.email || '').toLowerCase();
            const alreadyInCrm = (cleanP && existingPhoneSet.has(cleanP)) || (cleanE && existingEmailSet.has(cleanE));
            return {
                ...lead,
                alreadyInCrm: !!alreadyInCrm
            };
        });

        res.json({
            query: `${keyword} in ${targetCity}`,
            expandedTerms: synonyms,
            totalFound: verifiedLeads.length,
            newLeadsCount: verifiedLeads.filter(l => !l.alreadyInCrm).length,
            leads: verifiedLeads
        });

    } catch (error) {
        console.error('[PROSPECT SEARCH ERROR]', error);
        res.status(500).json({ message: error.message || 'Failed to search business prospects.' });
    }
});

// @desc    Import selected scraped leads into MongoDB (with website & social links)
// @route   POST /api/scraper/import-scraped
// @access  Private
router.post('/import-scraped', protect, async (req, res) => {
    try {
        const { leads } = req.body;
        if (!Array.isArray(leads) || leads.length === 0) {
            return res.status(400).json({ message: 'No leads provided for import' });
        }

        let importedCount = 0;
        let skippedCount = 0;

        for (const leadData of leads) {
            const cleanPhone = (leadData.phone || '').replace(/\D/g, '').slice(-10);
            const cleanEmail = (leadData.email || '').toLowerCase();

            let existing = null;
            if (cleanPhone) {
                existing = await Lead.findOne({ phone: new RegExp(cleanPhone + '$') });
            }
            if (!existing && cleanEmail) {
                existing = await Lead.findOne({ email: cleanEmail });
            }

            if (existing) {
                skippedCount++;
                continue;
            }

            await Lead.create({
                name: leadData.name || 'Scraped Prospect',
                phone: leadData.phone && leadData.phone !== 'N/A' ? leadData.phone : '0000000000',
                email: leadData.email || '',
                website: leadData.website || '',
                socialLink: leadData.socialLink || '',
                city: leadData.city || 'Extracted',
                course: leadData.course || 'Sales Inquiry',
                source: leadData.source || 'Web Scraper',
                status: 'New',
                aiScore: 'Warm',
                aiSummary: 'Extracted via AI Web Lead Scraper with Anti-Dummy verification.',
                activity: [{
                    description: `Lead imported via Web Scraper (${leadData.source || 'URL'})`,
                    timestamp: new Date()
                }]
            });

            importedCount++;
        }

        res.json({
            message: `Successfully imported ${importedCount} verified leads into database! (${skippedCount} duplicates skipped)`,
            importedCount,
            skippedCount
        });

    } catch (error) {
        console.error('[IMPORT SCRAPED ERROR]', error);
        res.status(500).json({ message: error.message || 'Failed to import scraped leads.' });
    }
});

module.exports = router;
