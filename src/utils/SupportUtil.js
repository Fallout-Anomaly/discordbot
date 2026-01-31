const { EmbedBuilder } = require('discord.js');
const db = require("./EconomyDB");
const config = require("../config");
const { error } = require("./Console");

/**
 * Utility functions for managing support threads
 */
class SupportUtil {
    /**
     * Initializes the followups table if it doesn't exist
     */
    static initializeTable() {
        return new Promise((resolve, reject) => {
            db.run(`CREATE TABLE IF NOT EXISTS support_followups (
                thread_id TEXT PRIMARY KEY,
                followup_time INTEGER NOT NULL,
                followup_message_id TEXT
            )`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Gets follow-up data for a thread
     */
    static getFollowupData(threadId) {
        return new Promise((resolve) => {
            db.get('SELECT * FROM support_followups WHERE thread_id = ?', [threadId], (err, row) => {
                if (err) error(`Error getting followup data for ${threadId}:`, err.message);
                resolve(row || null);
            });
        });
    }

    /**
     * Records that a follow-up message was sent
     */
    static recordFollowup(threadId, messageId = null) {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT OR REPLACE INTO support_followups (thread_id, followup_time, followup_message_id) VALUES (?, ?, ?)',
                [threadId, Date.now(), messageId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    /**
     * Removes follow-up record for a thread
     */
    static removeFollowup(threadId) {
        return new Promise((resolve) => {
            db.run('DELETE FROM support_followups WHERE thread_id = ?', [threadId], (err) => {
                if (err) error(`Error removing followup for ${threadId}:`, err.message);
                resolve();
            });
        });
    }

    /**
     * Sends a follow-up message to a thread
     */
    static async sendFollowupMessage(thread) {
        const embed = new EmbedBuilder()
            .setTitle('👋 Follow-up: Is Your Issue Resolved?')
            .setDescription(
                `Hey there! We noticed this thread has been inactive for **7+ days**.\n\n` +
                `✅ **If your issue is resolved**, please let us know or close this thread.\n` +
                `❓ **If you still need help**, reply with more details and we'll assist you.\n\n` +
                `⚠️ **This thread will be automatically closed in 24 hours if there's no response.**\n\n` +
                `📖 **Need setup help?** Check out our [Install Guide](https://fallout-anomaly.github.io/websitedev/)`
            )
            .setColor('#f39c12')
            .setFooter({ text: 'Anomaly Support System • React 👍/👎 for feedback' })
            .setTimestamp();

        const msg = await thread.send({ embeds: [embed] });
        await this.recordFollowup(thread.id, msg.id);
        return msg;
    }

    /**
     * Closes a thread (locks and archives it)
     */
    static async closeThread(thread, skipMessage = false) {
        if (!skipMessage) {
            const embed = new EmbedBuilder()
                .setTitle('🔒 Thread Closed - Inactivity')
                .setDescription(
                    `This support thread has been automatically closed due to **24 hours of inactivity** after our follow-up.\n\n` +
                    `✨ **Thank you for using Anomaly Support!**\n` +
                    `If you still need assistance, feel free to create a new post or contact staff directly.`
                )
                .setColor('#95a5a6')
                .setFooter({ text: 'Anomaly Support System • Auto-Close' })
                .setTimestamp();

            await thread.send({ embeds: [embed] }).catch(() => {});
        }
        
        await this.removeFollowup(thread.id);
        
        // Lock and archive the thread
        await thread.setLocked(true).catch(() => {});
        await thread.setArchived(true).catch(() => {});
    }

    /**
     * Runs a full cleanup cycle across all configured forum channels
     */
    static async runCleanupCycle(client, options = { action: 'both', limit: 50, minAge: 14 }) {
        const forumChannels = config.channels.forum_support || [];
        if (forumChannels.length === 0) return { scanned: 0, followups: 0, closed: 0, errors: 0 };

        let stats = { scanned: 0, followups: 0, closed: 0, errors: 0 };
        const { action, limit, minAge } = options;

        await this.initializeTable();

        for (const forumId of forumChannels) {
            const forum = await client.channels.fetch(forumId).catch(() => null);
            if (!forum || !forum.isThreadOnly()) continue;

            try {
                const fetchedThreads = await forum.threads.fetchActive();
                const archivedThreads = await forum.threads.fetchArchived({ limit: Math.min(limit, 100) });

                const allThreads = [...fetchedThreads.threads.values(), ...archivedThreads.threads.values()]
                    .filter(thread => !thread.locked)
                    .slice(0, limit);

                for (const thread of allThreads) {
                    stats.scanned++;
                    try {
                        const lastMessageFetch = await thread.messages.fetch({ limit: 1 }).catch(() => null);
                        let lastActiveTime = thread.createdTimestamp;
                        if (lastMessageFetch && lastMessageFetch.size > 0) {
                            lastActiveTime = lastMessageFetch.first().createdTimestamp;
                        }
                        
                        const daysSinceLastActivity = (Date.now() - lastActiveTime) / (1000 * 60 * 60 * 24);
                        const followupData = await this.getFollowupData(thread.id);

                        // 1. Force-close older than minAge (default 14 days)
                        if ((action === 'close' || action === 'both') && daysSinceLastActivity >= minAge) {
                            await this.closeThread(thread, true);
                            stats.closed++;
                            continue;
                        }

                        // 2. Follow-up 7+ days inactive
                        if ((action === 'followup' || action === 'both') && daysSinceLastActivity >= 7 && !followupData) {
                            // If thread is archived, unarchive it to send message
                            if (thread.archived) await thread.setArchived(false);
                            await this.sendFollowupMessage(thread);
                            stats.followups++;
                            continue;
                        }

                        // 3. Close after follow-up (24h)
                        if ((action === 'close' || action === 'both') && followupData) {
                            const hoursSinceFollowup = (Date.now() - followupData.followup_time) / (1000 * 60 * 60);
                            
                            // If user responded, clear cleanup flag to reset cycle
                            const recentMessages = await thread.messages.fetch({ limit: 20 }).catch(() => null);
                            const userResponded = recentMessages?.some(m => m.createdTimestamp > followupData.followup_time && !m.author.bot);
                            
                            if (userResponded) {
                                await this.removeFollowup(thread.id);
                                continue;
                            }

                            if (hoursSinceFollowup >= 24) {
                                // If thread is archived, unarchive momentarily to post closing message? 
                                // Actually, closeThread handles posting. We might need to unarchive first if posting fails on archived threads.
                                // Discord allows posting in archived threads (it unarchives them).
                                await this.closeThread(thread);
                                stats.closed++;
                            }
                        }
                    } catch (err) {
                        error(`[SUPPORT UTIL] Thread ${thread.id} error:`, err);
                        stats.errors++;
                    }
                }
            } catch (err) {
                error(`[SUPPORT UTIL] Forum ${forumId} error:`, err);
                stats.errors++;
            }
        }
        return stats;
    }
}

module.exports = SupportUtil;
