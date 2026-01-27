const { EmbedBuilder } = require('discord.js');
const Event = require("../../structure/Event");
const config = require("../../config");
const db = require("../../utils/EconomyDB");
const { error, info } = require("../../utils/Console");

// Track interval to prevent duplicates on reload
let cleanupInterval = null;

module.exports = new Event({
    event: 'ready',
    run: (client) => {
        // Initialize the support followups table
        db.run(`CREATE TABLE IF NOT EXISTS support_followups (
            thread_id TEXT PRIMARY KEY,
            followup_time INTEGER NOT NULL,
            followup_message_id TEXT
        )`, (err) => {
            if (err) error('[SUPPORT CLEANUP] Failed to create followups table:', err);
        });

        // Prevent duplicate intervals
        if (cleanupInterval) {
            clearInterval(cleanupInterval);
        }

        // Run cleanup every 6 hours (21600000 ms)
        // Initial run after 5 minutes, then every 6 hours
        setTimeout(() => {
            runCleanupCycle(client);
            cleanupInterval = setInterval(() => runCleanupCycle(client), 6 * 60 * 60 * 1000);
        }, 5 * 60 * 1000);

        info('[SUPPORT CLEANUP] Automated cleanup scheduler initialized (runs every 6 hours)');
    }
}).toJSON();

async function runCleanupCycle(client) {
    info('[SUPPORT CLEANUP] Starting automated cleanup cycle...');

    const forumChannels = config.channels.forum_support || [];
    if (forumChannels.length === 0) return;

    let stats = {
        scanned: 0,
        followups: 0,
        closed: 0,
        errors: 0
    };

    for (const forumId of forumChannels) {
        const forum = await client.channels.fetch(forumId).catch(() => null);
        if (!forum || !forum.isThreadOnly()) continue;

        try {
            const fetchedThreads = await forum.threads.fetchActive();
            const archivedThreads = await forum.threads.fetchArchived({ limit: 50 });

            const allThreads = [...fetchedThreads.threads.values(), ...archivedThreads.threads.values()]
                .filter(thread => !thread.locked && !thread.archived)
                .slice(0, 100);

            for (const thread of allThreads) {
                stats.scanned++;

                try {
                    const messages = await thread.messages.fetch({ limit: 10 });
                    if (messages.size === 0) continue;

                    const lastMessage = messages.first();
                    const timeSinceLastMessage = Date.now() - lastMessage.createdTimestamp;
                    const daysSinceLastMessage = timeSinceLastMessage / (1000 * 60 * 60 * 24);

                    const followupData = await getFollowupData(thread.id);

                    // Step 1: Send follow-up for threads inactive 7+ days
                    if (daysSinceLastMessage >= 7 && !followupData) {
                        await sendFollowupMessage(thread);
                        stats.followups++;
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }

                    // Step 2: Close threads 24h+ after follow-up with no user response
                    if (followupData) {
                        const timeSinceFollowup = Date.now() - followupData.followup_time;
                        const hoursSinceFollowup = timeSinceFollowup / (1000 * 60 * 60);

                        const messagesAfterFollowup = messages.filter(m => m.createdTimestamp > followupData.followup_time);
                        const userRespondedAfterFollowup = messagesAfterFollowup.some(m => !m.author.bot);

                        if (hoursSinceFollowup >= 24 && !userRespondedAfterFollowup) {
                            await closeThread(thread);
                            stats.closed++;
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                    }

                } catch (err) {
                    error(`[SUPPORT CLEANUP] Error processing thread ${thread.id}:`, err);
                    stats.errors++;
                }
            }
        } catch (err) {
            error(`[SUPPORT CLEANUP] Error fetching threads from forum ${forumId}:`, err);
            stats.errors++;
        }
    }

    info(`[SUPPORT CLEANUP] Cycle complete: ${stats.scanned} scanned, ${stats.followups} followups, ${stats.closed} closed, ${stats.errors} errors`);
}

function getFollowupData(threadId) {
    return new Promise((resolve) => {
        db.get('SELECT * FROM support_followups WHERE thread_id = ?', [threadId], (err, row) => {
            resolve(row || null);
        });
    });
}

function recordFollowup(threadId, messageId = null) {
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

function removeFollowup(threadId) {
    return new Promise((resolve) => {
        db.run('DELETE FROM support_followups WHERE thread_id = ?', [threadId], () => resolve());
    });
}

async function sendFollowupMessage(thread) {
    const embed = new EmbedBuilder()
        .setTitle('👋 Follow-up: Is Your Issue Resolved?')
        .setDescription(
            `Hey there! We noticed this thread has been inactive for **7+ days**.\n\n` +
            `✅ **If your issue is resolved**, please let us know or close this thread.\n` +
            `❓ **If you still need help**, reply with more details and we'll assist you.\n\n` +
            `⚠️ **This thread will be automatically closed in 24 hours if there's no response.**`
        )
        .setColor('#f39c12')
        .setFooter({ text: 'Anomaly Support System • Auto-Follow-up' })
        .setTimestamp();

    const msg = await thread.send({ embeds: [embed] });
    await recordFollowup(thread.id, msg.id);
}

async function closeThread(thread) {
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

    await thread.send({ embeds: [embed] });
    await removeFollowup(thread.id);
    
    // Lock and archive the thread
    await thread.setLocked(true);
    await thread.setArchived(true);
}
