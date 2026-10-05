/**
 * emailParser.js
 * Comprehensive MIME parser, OTP/verification code extractor, and spam detector
 */

// Helper: Decode MIME encoded-word (e.g. =?UTF-8?B?...?= or =?UTF-8?Q?...?=)
const decodeMimeHeader = (str = '') => {
    if (!str) return '';
    return str.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_, charset, encoding, text) => {
        try {
            if (encoding.toUpperCase() === 'B') {
                return Buffer.from(text, 'base64').toString(charset.toLowerCase() === 'utf-8' ? 'utf-8' : 'utf-8');
            } else if (encoding.toUpperCase() === 'Q') {
                return decodeQuotedPrintable(text.replace(/_/g, ' '));
            }
        } catch (e) {
            return text;
        }
        return text;
    });
};

// Helper: Decode Quoted-Printable string
const decodeQuotedPrintable = (str = '') => {
    if (!str) return '';
    // Remove soft line breaks: '=\r\n' or '=\n'
    const cleanStr = str.replace(/=\r?\n/g, '');
    
    // Replace =XX with byte values and decode as UTF-8
    const bytes = [];
    for (let i = 0; i < cleanStr.length; i++) {
        if (cleanStr[i] === '=' && i + 2 < cleanStr.length) {
            const hex = cleanStr.substr(i + 1, 2);
            if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
                bytes.push(parseInt(hex, 16));
                i += 2;
                continue;
            }
        }
        bytes.push(cleanStr.charCodeAt(i));
    }
    return Buffer.from(bytes).toString('utf-8');
};

// Extract OTP or verification code from subject and content
const extractVerificationCode = (subject = '', text = '', html = '') => {
    const combined = `${subject}\n${text}\n${html}`;

    // Common verification code patterns (Google, Microsoft, Amazon, WhatsApp, etc.)
    const patterns = [
        /(?:Google\s*verification\s*code|G-)\s*[:\-]?\s*([0-9]{6})/i,
        /(?:verification\s*code|verify\s*code|confirmation\s*code|security\s*code|your\s*code\s*is|one-time\s*password|OTP)\s*[:\-]?\s*([0-9]{4,8})/i,
        /(?:use\s*code|enter\s*code|code\s*is)\s*[:\-]?\s*<b>([0-9]{4,8})<\/b>/i,
        /\b([0-9]{6})\s+is\s+your\s+(?:Google|verification|security)\s+code/i,
        /<strong[^>]*>([0-9]{4,8})<\/strong>/i,
        /<b[^>]*>([0-9]{4,8})<\/b>/i,
        /\b([0-9]{6})\b/
    ];

    for (const pat of patterns) {
        const match = combined.match(pat);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    return '';
};

// Detect spam from headers and content
const detectSpam = (headers = {}, subject = '', text = '') => {
    const headerStr = JSON.stringify(headers).toLowerCase();

    // Explicit Spam headers
    if (headerStr.includes('x-spam-flag: yes') || headerStr.includes('x-spam-status: yes')) {
        return { isSpam: true, reason: 'Flagged by Spam Filter' };
    }

    // SPF / DMARC failure headers
    if (headerStr.includes('spf=fail') || headerStr.includes('dmarc=fail')) {
        return { isSpam: true, reason: 'SPF/DMARC Verification Failed' };
    }

    const combined = `${subject} ${text}`.toLowerCase();
    const spamKeywords = [
        /\b(viagra|cialis)\b/,
        /\b(claim\s*your\s*prize|you\s*won\s*a\s*lottery)\b/,
        /\b(nigerian\s*prince|transfer\s*million\s*dollars)\b/,
        /\b(crypto\s*airdrop\s*giveaway|free\s*bitcoin\s*claim)\b/,
        /\b(urgent\s*wire\s*transfer\s*request)\b/
    ];

    for (const kw of spamKeywords) {
        if (kw.test(combined)) {
            return { isSpam: true, reason: 'High-risk Spam Keywords' };
        }
    }

    return { isSpam: false, reason: '' };
};

// Main function: Parse raw MIME email into structured fields
const parseMimeEmail = (raw = '') => {
    if (!raw || typeof raw !== 'string') {
        return { subject: '', text: '', html: '', from: '', to: '', verificationCode: '', isSpam: false };
    }

    // Split headers from body (first double newline)
    const headerEndMatch = raw.match(/\r?\n\r?\n/);
    const headerEndIndex = headerEndMatch ? headerEndMatch.index : -1;

    let headerSection = '';
    let bodySection = raw;

    if (headerEndIndex !== -1) {
        headerSection = raw.substring(0, headerEndIndex);
        bodySection = raw.substring(headerEndIndex + headerEndMatch[0].length);
    }

    // Parse headers (handling folded lines starting with space or tab)
    const headers = {};
    const headerLines = headerSection.split(/\r?\n/);
    let currentKey = null;

    for (const line of headerLines) {
        if (/^[\t ]/.test(line) && currentKey) {
            headers[currentKey] += ' ' + line.trim();
        } else {
            const colonIdx = line.indexOf(':');
            if (colonIdx > 0) {
                currentKey = line.substring(0, colonIdx).trim().toLowerCase();
                headers[currentKey] = line.substring(colonIdx + 1).trim();
            }
        }
    }

    const subject = decodeMimeHeader(headers['subject'] || '');
    const from = decodeMimeHeader(headers['from'] || '');
    const to = decodeMimeHeader(headers['to'] || '');
    const contentType = headers['content-type'] || 'text/plain';

    let extractedText = '';
    let extractedHtml = '';

    // Check if multipart email
    const boundaryMatch = contentType.match(/boundary="?([^";\r\n]+)"?/i);

    if (boundaryMatch && boundaryMatch[1]) {
        const boundary = boundaryMatch[1];
        const parts = bodySection.split(new RegExp(`--${boundary}(?:--)?`));

        for (const part of parts) {
            const trimmedPart = part.trim();
            if (!trimmedPart || trimmedPart === '--') continue;

            const partHeaderEnd = trimmedPart.match(/\r?\n\r?\n/);
            if (!partHeaderEnd) continue;

            const partHeaders = trimmedPart.substring(0, partHeaderEnd.index).toLowerCase();
            let partBody = trimmedPart.substring(partHeaderEnd.index + partHeaderEnd[0].length);

            // Handle encoding
            if (partHeaders.includes('content-transfer-encoding: quoted-printable')) {
                partBody = decodeQuotedPrintable(partBody);
            } else if (partHeaders.includes('content-transfer-encoding: base64')) {
                try {
                    partBody = Buffer.from(partBody.replace(/\s/g, ''), 'base64').toString('utf-8');
                } catch (e) {}
            }

            if (partHeaders.includes('text/html')) {
                extractedHtml = partBody;
            } else if (partHeaders.includes('text/plain')) {
                extractedText = partBody;
            }
        }
    } else {
        // Single part email
        let body = bodySection;
        const encoding = (headers['content-transfer-encoding'] || '').toLowerCase();
        if (encoding.includes('quoted-printable')) {
            body = decodeQuotedPrintable(body);
        } else if (encoding.includes('base64')) {
            try {
                body = Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf-8');
            } catch (e) {}
        }

        if (contentType.toLowerCase().includes('text/html')) {
            extractedHtml = body;
            extractedText = body.replace(/<[^>]+>/g, ' ');
        } else {
            extractedText = body;
        }
    }

    // Fallback: If only HTML found, generate text
    if (!extractedText && extractedHtml) {
        extractedText = extractedHtml
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Extract OTP / Google verification code
    const verificationCode = extractVerificationCode(subject, extractedText, extractedHtml);

    // Spam check
    const spamCheck = detectSpam(headers, subject, extractedText);

    return {
        subject,
        from,
        to,
        text: extractedText.trim(),
        html: extractedHtml.trim(),
        verificationCode,
        isSpam: spamCheck.isSpam,
        spamReason: spamCheck.reason
    };
};

module.exports = {
    parseMimeEmail,
    extractVerificationCode,
    detectSpam,
    decodeQuotedPrintable,
    decodeMimeHeader
};
