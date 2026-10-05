const axios = require('axios');

// Hugging Face details (Llama 3 is highly capable for instructions)
const HF_MODEL = 'meta-llama/Meta-Llama-3-8B-Instruct';
const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

// Helper: Call Hugging Face API
const callHuggingFace = async (prompt) => {
    const token = process.env.HUGGING_FACE_TOKEN;
    if (!token) throw new Error('No Hugging Face token provided.');

    const response = await axios.post(
        HF_URL,
        {
            inputs: `<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`,
            parameters: { max_new_tokens: 250, temperature: 0.3 }
        },
        {
            headers: { Authorization: `Bearer ${token}` }
        }
    );

    let text = '';
    if (Array.isArray(response.data) && response.data[0]) {
        text = response.data[0].generated_text || '';
    } else if (response.data && response.data.generated_text) {
        text = response.data.generated_text;
    }

    // Clean up instructions wrapper
    const assistantIndex = text.indexOf('<|start_header_id|>assistant<|end_header_id|>');
    if (assistantIndex !== -1) {
        text = text.substring(assistantIndex + '<|start_header_id|>assistant<|end_header_id|>'.length).trim();
    }
    return text.replace(/<\|eot_id\|>|\\n/g, '').trim();
};

// Helper: Call Ollama API
const callOllama = async (prompt) => {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
    const response = await axios.post(ollamaUrl, {
        model: 'llama3',
        prompt: prompt,
        stream: false,
        options: { temperature: 0.3 }
    });
    return response.data.response.trim();
};

// Heuristics: Rule-based Analysis (Robust backup)
const runHeuristicsScoring = (lead) => {
    const name = lead.name || '';
    const course = (lead.course || '').toLowerCase();
    const profession = (lead.profession || '').toLowerCase();
    const experience = (lead.experience || '').toLowerCase();
    const qualification = (lead.qualification || '').toLowerCase();
    const status = (lead.status || 'New').toLowerCase();
    const source = (lead.source || '').toLowerCase();

    let score = 'Warm'; // Default
    let summary = `Lead ${name} interested in ${lead.course || 'CRM training'}.`;

    // Scoring heuristics
    const hotKeywords = ['enquiry', 'urgent', 'now', 'interested', 'call back', 'admission', 'fee'];
    const coldKeywords = ['not interested', 'wrong number', 'student', 'job seeker', 'no answer'];

    const details = `${course} ${profession} ${experience} ${qualification} ${status} ${source}`;

    let hotMatches = hotKeywords.filter(k => details.includes(k)).length;
    let coldMatches = coldKeywords.filter(k => details.includes(k)).length;

    if (hotMatches > coldMatches || status === 'hot' || status === 'follow-up') {
        score = 'Hot';
        summary = `🔥 Hot prospect: ${name} is actively seeking details about ${lead.course || 'the course'}.`;
    } else if (coldMatches > hotMatches || status === 'lost' || status === 'not interested') {
        score = 'Cold';
        summary = `❄️ Cold prospect: ${name} shows low engagement indicators.`;
    } else {
        score = 'Warm';
    }
    return { aiScore: score, aiSummary: summary };
};

// Heuristics: Template-based email & WhatsApp generator (Robust backup)
const runHeuristicsEmailDraft = (lead, type, userPrompt = '') => {
    const name = lead.name || 'Client';
    const course = lead.course || 'our services & solutions';
    
    let subject = '';
    let body = '';
    let whatsappText = '';

    if (type === 'pricing') {
        subject = `Details regarding fees & pricing for ${course}`;
        body = `Dear ${name},\n\nThank you for reaching out to us. As requested, here are the pricing details for ${course}:\n\n- Custom packages available.\n- Mode: Online / Live / In-person\n${userPrompt ? `\nNote: ${userPrompt}\n` : ''}\nLet's schedule a short call to discuss the best package for you.\n\nBest regards,\nSales & Admissions Team`;
        whatsappText = `Hi ${name}! 👋 Here are the pricing & service details for ${course}. ${userPrompt ? `(${userPrompt})` : ''} Let us know a good time to connect!`;
    } else if (type === 'followup') {
        subject = `Following up regarding: ${course}`;
        body = `Dear ${name},\n\nI hope you are doing well.\n\nI am writing to follow up on your inquiry regarding ${course}. ${userPrompt ? `\nNote: ${userPrompt}\n` : ''}Please let us know a convenient time to schedule a short 5-minute call.\n\nBest regards,\nSales & Admissions Team`;
        whatsappText = `Hello ${name}! 📲 Following up on your inquiry regarding ${course}. ${userPrompt ? `(${userPrompt})` : ''} When is a good time for a quick 5-minute call?`;
    } else {
        // Outreach / Cold message
        subject = `Exclusive Outreach: ${course} for ${name}`;
        body = `Dear ${name},\n\nThank you for your interest in ${course}.\n\n${userPrompt ? `Special Note: ${userPrompt}\n\n` : ''}Our team would love to share tailored details and help answer any questions you have.\n\nHave a great day!\n\nBest regards,\nSales & Admissions Team`;
        whatsappText = `Hello ${name}! 👋 ${userPrompt ? `${userPrompt}. ` : ''}We'd love to share quick details about ${course} with you. Reply back to connect!`;
    }

    return { subject, body, whatsappText };
};

/**
 * AI Lead Analyzer: Classifies leads and generates summaries
 */
const analyzeLeadProfile = async (lead) => {
    const prompt = `
Analyze this client lead profile and return a JSON object ONLY containing keys "aiScore" (which must be exactly "Hot", "Warm", or "Cold") and "aiSummary" (a single sentence summarizing their potential).
Lead profile:
Name: ${lead.name}
Course: ${lead.course}
Profession: ${lead.profession}
Experience: ${lead.experience}
Qualification: ${lead.qualification}
Status: ${lead.status}
Source: ${lead.source}

Ensure the response is valid JSON. Example: {"aiScore": "Hot", "aiSummary": "Candidate shows high interest and is a relevant match."}
`;

    try {
        let rawResponse = '';
        if (process.env.HUGGING_FACE_TOKEN) {
            rawResponse = await callHuggingFace(prompt);
        } else if (process.env.OLLAMA_URL || process.env.RUN_OLLAMA === 'true') {
            rawResponse = await callOllama(prompt);
        } else {
            return runHeuristicsScoring(lead);
        }

        console.log('[AI] Raw scoring response:', rawResponse);
        // Find JSON boundaries
        const jsonStart = rawResponse.indexOf('{');
        const jsonEnd = rawResponse.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
            const cleanJson = rawResponse.substring(jsonStart, jsonEnd + 1);
            const parsed = JSON.parse(cleanJson);
            if (['Hot', 'Warm', 'Cold'].includes(parsed.aiScore) && parsed.aiSummary) {
                return {
                    aiScore: parsed.aiScore,
                    aiSummary: parsed.aiSummary
                };
            }
        }
        throw new Error('Invalid JSON format from AI');
    } catch (error) {
        console.warn('[AI Service] Lead analysis fallback to heuristics:', error.message);
        return runHeuristicsScoring(lead);
    }
};

/**
 * AI Email & WhatsApp Cold Message Drafter
 */
const generateEmailDraft = async (lead, type = 'outreach', userPrompt = '') => {
    const prompt = `
Draft a cold outreach message copy for client "${lead.name || 'Client'}".
Lead Details:
Name: ${lead.name}
Interest/Course: ${lead.course}
Profession: ${lead.profession}
City: ${lead.city}

Outreach Category: "${type}"
User Instruction: "${userPrompt}"

Return a JSON object ONLY containing 3 keys:
"subject": Email subject line
"body": Professional email body text
"whatsappText": Short, friendly WhatsApp message (formatted with emojis)
`;

    try {
        let rawResponse = '';
        if (process.env.HUGGING_FACE_TOKEN) {
            rawResponse = await callHuggingFace(prompt);
        } else if (process.env.OLLAMA_URL || process.env.RUN_OLLAMA === 'true') {
            rawResponse = await callOllama(prompt);
        } else {
            return runHeuristicsEmailDraft(lead, type, userPrompt);
        }

        console.log('[AI] Raw draft response:', rawResponse);
        const jsonStart = rawResponse.indexOf('{');
        const jsonEnd = rawResponse.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
            const cleanJson = rawResponse.substring(jsonStart, jsonEnd + 1);
            const parsed = JSON.parse(cleanJson);
            return {
                subject: parsed.subject || `Outreach for ${lead.name}`,
                body: parsed.body || `Hello ${lead.name}, thank you for your interest.`,
                whatsappText: parsed.whatsappText || `Hello ${lead.name}! We'd love to share quick details with you.`
            };
        }
        return runHeuristicsEmailDraft(lead, type, userPrompt);
    } catch (error) {
        console.warn('[AI Service] Draft generation fallback to heuristics:', error.message);
        return runHeuristicsEmailDraft(lead, type, userPrompt);
    }
};

module.exports = {
    analyzeLeadProfile,
    generateEmailDraft,
    runHeuristicsScoring
};
