const axios = require('axios');
const path = require('path');
const fs = require('fs');
const Mailbox = require('../models/Mailbox');
const { encrypt } = require('../utils/crypto');

const HOSTINGER_API_BASE = 'https://api.mail.hostinger.com';

class HostingerMailService {
    getHeaders(customApiKey) {
        const key = (customApiKey || process.env.HOSTINGER_MAIL_API_KEY || '').trim();
        if (!key) {
            throw new Error('Hostinger Mail API Key not configured. Please set it in .env or Mailbox Manager.');
        }
        return {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    /**
     * Verify API Token connectivity
     */
    async testConnection(customApiKey) {
        const headers = this.getHeaders(customApiKey);
        try {
            const res = await axios.get(`${HOSTINGER_API_BASE}/api/v1/me`, { headers, timeout: 10000 });
            const mailboxes = res.data?.data?.mailboxes || [];
            return {
                success: true,
                message: `✓ Connected to Hostinger Agentic Mail API (${mailboxes.length} mailboxes detected)`,
                data: {
                    orderResourceId: res.data?.data?.orderResourceId,
                    totalMailboxes: mailboxes.length,
                    sample: mailboxes.slice(0, 3)
                }
            };
        } catch (error) {
            console.error('[HOSTINGER API ERROR]', error.response?.data || error.message);
            let errMsg = 'Connection failed';
            if (error.response?.data) {
                const d = error.response.data;
                if (typeof d === 'string') errMsg = d;
                else if (typeof d.message === 'string') errMsg = d.message;
                else if (typeof d.error === 'string') errMsg = d.error;
                else if (typeof d.error?.message === 'string') errMsg = d.error.message;
                else errMsg = JSON.stringify(d);
            } else if (error.message) {
                errMsg = error.message;
            }
            if (error.response?.status === 401) {
                errMsg = `Hostinger rejected token (401 Unauthorized): ${errMsg}. Please verify your Hostinger API Bearer Token in hPanel.`;
            } else if (error.response?.status === 404) {
                errMsg = `Hostinger endpoint 404 Not Found: ${errMsg}`;
            }
            throw new Error(errMsg);
        }
    }

    /**
     * List all mailboxes under the domain from Hostinger Mail API
     */
    async listMailboxes(customApiKey) {
        const headers = this.getHeaders(customApiKey);
        try {
            const res = await axios.get(`${HOSTINGER_API_BASE}/api/v1/me`, { headers, timeout: 15000 });
            const mailboxes = res.data?.data?.mailboxes || [];
            return mailboxes;
        } catch (error) {
            console.error('[HOSTINGER LIST MAILBOXES ERROR]', error.response?.data || error.message);
            const errMsg = error.response?.data?.error || error.response?.data?.message || error.message;
            throw new Error(errMsg);
        }
    }

    /**
     * Send email via Hostinger Agentic Mail API
     */
    async sendEmail({ customApiKey, mailboxResourceId, fromEmail, toEmail, subject, html, text, displayName }) {
        const headers = this.getHeaders(customApiKey);
        if (!mailboxResourceId) {
            throw new Error(`Cannot send via API: mailboxResourceId is missing for ${fromEmail}`);
        }

        try {
            const endpoint = `${HOSTINGER_API_BASE}/api/v1/mailboxes/${encodeURIComponent(mailboxResourceId)}/send`;
            const payload = {
                to: Array.isArray(toEmail) ? toEmail : [toEmail],
                displayName: displayName || (fromEmail ? fromEmail.split('@')[0] : 'Support'),
                subject: subject,
                html: html,
                text: text || ''
            };

            const res = await axios.post(endpoint, payload, { headers, timeout: 15000 });
            return {
                success: true,
                status: res.status,
                messageId: `hostinger-api-${Date.now()}`
            };
        } catch (error) {
            console.error('[HOSTINGER SEND API ERROR]', error.response?.data || error.message);
            const errMsg = error.response?.data?.error || error.response?.data?.message || error.message;
            throw new Error(errMsg);
        }
    }

    /**
     * Sync Hostinger API mailboxes into MongoDB Mailbox collection
     */
    async syncMailboxesToDatabase({ userId, customApiKey, defaultLimit = 500 }) {
        const remoteMailboxes = await this.listMailboxes(customApiKey);
        if (!remoteMailboxes || remoteMailboxes.length === 0) {
            return { syncedCount: 0, message: 'No remote mailboxes returned by Hostinger API' };
        }

        let syncedCount = 0;
        let createdCount = 0;
        let updatedCount = 0;

        for (const mb of remoteMailboxes) {
            const email = (mb.address || mb.email || '').trim().toLowerCase();
            const resourceId = mb.resourceId || mb.id || '';
            if (!email || !email.includes('@')) continue;

            const username = email.split('@')[0];
            const senderName = username.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const password = `Hi${username}@123`;
            const encryptedPass = encrypt(password);

            const existing = await Mailbox.findOne({ userId, emailUser: email });
            if (existing) {
                existing.status = 'active';
                existing.provider = 'hostinger';
                existing.mailboxResourceId = resourceId;
                existing.isApiManaged = true;
                existing.emailPass = encryptedPass;
                existing.dailyLimit = existing.dailyLimit || defaultLimit;
                existing.lastError = '';
                await existing.save();
                updatedCount++;
            } else {
                await Mailbox.create({
                    userId,
                    senderName,
                    emailUser: email,
                    emailPass: encryptedPass,
                    provider: 'hostinger',
                    smtpHost: 'smtp.hostinger.com',
                    smtpPort: 465,
                    smtpSecure: true,
                    mailboxResourceId: resourceId,
                    isApiManaged: true,
                    dailyLimit: defaultLimit,
                    status: 'active'
                });
                createdCount++;
            }
            syncedCount++;
        }

        return {
            totalRemote: remoteMailboxes.length,
            syncedCount,
            createdCount,
            updatedCount,
            message: `Successfully synchronized ${syncedCount} Hostinger mailboxes into CRM (${createdCount} added, ${updatedCount} updated).`
        };
    }
}

module.exports = new HostingerMailService();
