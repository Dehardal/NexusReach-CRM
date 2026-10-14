const nodemailer = require('nodemailer');
const Mailbox = require('../models/Mailbox');
const Lead = require('../models/Lead');
const Email = require('../models/Email');
const Campaign = require('../models/Campaign');
const { decrypt } = require('../utils/crypto');
const hostingerMailService = require('./hostingerMailService');

// Template variable replacer
const replaceVariables = (template = '', lead) => {
    return template
        .replace(/{{name}}/gi, lead.name || 'there')
        .replace(/{{firstName}}/gi, (lead.name || 'there').split(' ')[0])
        .replace(/{{email}}/gi, lead.email || '')
        .replace(/{{phone}}/gi, lead.phone || '')
        .replace(/{{course}}/gi, lead.course || 'the program')
        .replace(/{{city}}/gi, lead.city || 'your city');
};

const sendCampaignBatch = async ({ campaignId, userId, leadIds, subject, bodyHtml, bodyText, mailboxIds, io }) => {
    try {
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) throw new Error('Campaign record not found');

        // Retrieve sender mailboxes
        const User = require('../models/User');
        const userObj = await User.findById(userId);
        let mailboxFilter = { status: 'active' };
        if (userObj && userObj.role !== 'master') {
            mailboxFilter.$or = [{ userId }, { assignedTo: userId }];
        }
        if (Array.isArray(mailboxIds) && mailboxIds.length > 0) {
            mailboxFilter._id = { $in: mailboxIds };
        }

        const mailboxes = await Mailbox.find(mailboxFilter);
        if (mailboxes.length === 0) {
            campaign.status = 'failed';
            await campaign.save();
            throw new Error('No active Hostinger mailboxes available. Please connect and verify at least one mailbox.');
        }

        // Retrieve target leads
        let leadQuery = { isHidden: false };
        if (Array.isArray(leadIds) && leadIds.length > 0) {
            leadQuery._id = { $in: leadIds };
        } else {
            // Default to leads assigned to this user that have not been sent a campaign
            leadQuery.assignedTo = userId;
            leadQuery.campaignStatus = { $in: ['uncontacted', 'queued'] };
        }

        const leads = await Lead.find(leadQuery);
        if (leads.length === 0) {
            campaign.status = 'completed';
            campaign.completedAt = new Date();
            await campaign.save();
            return { totalSent: 0, totalFailed: 0, message: 'No eligible leads found for this campaign' };
        }

        campaign.totalRecipients = leads.length;
        campaign.status = 'sending';
        await campaign.save();

        let sentCount = 0;
        let failedCount = 0;

        // Cache transporters to avoid recreating for every lead
        const transporters = new Map();
        for (const mb of mailboxes) {
            const pass = decrypt(mb.emailPass);
            const authUser = mb.smtpUser || mb.emailUser;
            const isGmailOrCloudflare = mb.provider === 'gmail' || mb.provider === 'cloudflare' || (mb.smtpHost && mb.smtpHost.includes('gmail.com'));
            
            const transportConfig = isGmailOrCloudflare ? {
                service: 'gmail',
                auth: {
                    user: authUser,
                    pass
                },
                connectionTimeout: 10000
            } : {
                host: mb.smtpHost || 'smtp.hostinger.com',
                port: Number(mb.smtpPort) || 465,
                secure: Number(mb.smtpPort) === 465 || mb.smtpSecure,
                auth: {
                    user: authUser,
                    pass
                },
                connectionTimeout: 10000
            };

            const transporter = nodemailer.createTransport(transportConfig);
            transporters.set(mb._id.toString(), transporter);
        }

        console.log(`[CAMPAIGN START] Launching campaign "${campaign.name}" for ${leads.length} leads across ${mailboxes.length} active mailboxes/aliases`);

        // Iterate through leads with round-robin rotation
        for (let i = 0; i < leads.length; i++) {
            const lead = leads[i];
            if (!lead.email || !lead.email.includes('@')) {
                failedCount++;
                continue;
            }

            // Pick mailbox round-robin
            const currentMailbox = mailboxes[i % mailboxes.length];
            const transporter = transporters.get(currentMailbox._id.toString());

            const personalSubject = replaceVariables(subject, lead);
            const personalHtml = replaceVariables(bodyHtml, lead);
            const personalText = replaceVariables(bodyText || '', lead);

            try {
                let sentViaApi = false;
                const apiKey = process.env.HOSTINGER_MAIL_API_KEY;

                // Priority 1: Direct Hostinger Agentic Mail API
                if (currentMailbox.mailboxResourceId && apiKey) {
                    try {
                        await hostingerMailService.sendEmail({
                            customApiKey: apiKey,
                            mailboxResourceId: currentMailbox.mailboxResourceId,
                            fromEmail: currentMailbox.emailUser,
                            displayName: currentMailbox.senderName,
                            toEmail: lead.email,
                            subject: personalSubject,
                            html: personalHtml,
                            text: personalText
                        });
                        sentViaApi = true;
                    } catch (apiErr) {
                        console.warn(`[CAMPAIGN API WARNING] Mailbox ${currentMailbox.emailUser} API send failed, falling back to SMTP:`, apiErr.message);
                    }
                }

                // Priority 2: Fallback to high-speed SMTP
                if (!sentViaApi) {
                    const messageId = `<campaign-${campaign._id}-${lead._id}-${Date.now()}@${currentMailbox.emailUser.split('@')[1]}>`;
                    await transporter.sendMail({
                        from: `"${currentMailbox.senderName || 'Admissions'}" <${currentMailbox.emailUser}>`,
                        to: lead.email,
                        subject: personalSubject,
                        html: personalHtml,
                        text: personalText,
                        messageId: messageId,
                        headers: {
                            'X-Campaign-ID': campaign._id.toString(),
                            'X-Lead-ID': lead._id.toString(),
                            'X-Mailbox-ID': currentMailbox._id.toString()
                        }
                    });
                }

                sentCount++;

                // Update Lead
                lead.campaignStatus = 'sent';
                lead.status = lead.status === 'New' ? 'Contacted' : lead.status;
                lead.activity.push({
                    description: `Sent Campaign Email "${personalSubject}" via ${currentMailbox.emailUser}`,
                    timestamp: new Date()
                });
                await lead.save();

                // Save Email document
                await Email.create({
                    from: currentMailbox.emailUser,
                    fromName: currentMailbox.senderName,
                    to: lead.email,
                    subject: personalSubject,
                    text: personalText,
                    html: personalHtml,
                    direction: 'outbound',
                    folder: 'sent',
                    leadId: lead._id,
                    userId: userId,
                    isRead: true
                });

                // Update Mailbox counters
                await Mailbox.findByIdAndUpdate(currentMailbox._id, {
                    $inc: { sentToday: 1, 'stats.totalSent': 1 },
                    lastSentAt: new Date()
                });

                // Emit progress via Socket.IO every 5 sends or on completion
                if (io && (sentCount % 5 === 0 || i === leads.length - 1)) {
                    io.emit('campaign_progress', {
                        campaignId: campaign._id,
                        sentCount,
                        failedCount,
                        totalRecipients: leads.length,
                        percent: Math.round(((sentCount + failedCount) / leads.length) * 100)
                    });
                }

                // Small pacing pause (250ms) to ensure smooth sending without getting rate-limited
                await new Promise(r => setTimeout(r, 250));

            } catch (sendErr) {
                console.error(`[CAMPAIGN SEND FAILED] Lead: ${lead.email} via ${currentMailbox.emailUser}:`, sendErr.message);
                failedCount++;
                
                // If mailbox failed due to auth/limit, record error
                await Mailbox.findByIdAndUpdate(currentMailbox._id, {
                    lastError: sendErr.message
                });
            }
        }

        // Finalize campaign
        campaign.sentCount = sentCount;
        campaign.failedCount = failedCount;
        campaign.status = 'completed';
        campaign.completedAt = new Date();
        await campaign.save();

        console.log(`[CAMPAIGN FINISHED] Campaign "${campaign.name}" completed. Sent: ${sentCount}, Failed: ${failedCount}`);

        return {
            success: true,
            sentCount,
            failedCount,
            totalRecipients: leads.length
        };

    } catch (err) {
        console.error('[CAMPAIGN ERROR]', err.message);
        throw err;
    }
};

module.exports = {
    sendCampaignBatch,
    replaceVariables
};
