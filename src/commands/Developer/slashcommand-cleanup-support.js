const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");
const config = require("../../config");
const db = require("../../utils/EconomyDB");
const { error } = require("../../utils/Console");

module.exports = new ApplicationCommand({
    command: {
        name: 'cleanup-support',
        description: 'Manage inactive support threads: send follow-ups and auto-close unresponsive threads.',
        defer: 'ephemeral',
        options: [
            {
                name: 'action',
                description: 'Action to perform',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { name: 'Send Follow-ups (7+ days inactive)', value: 'followup' },
                    { name: 'Close Stale Threads (24h+ after follow-up)', value: 'close' },
                    { name: 'Both (Follow-up & Close)', value: 'both' }
                ]
            },
            {
                name: 'limit',
                description: 'Max threads to process per forum (default 50)',
                type: ApplicationCommandOptionType.Integer,
                required: false
            }
        ]
    },
    options: {
        botOwner: true
    },
    run: async (client, interaction) => {
        const action = interaction.options.getString('action');
        const limit = interaction.options.getInteger('limit') || 50;

        const forumChannels = config.channels.forum_support || [];
        if (forumChannels.length === 0) {
            return interaction.editReply({ content: '❌ No forum support channels configured in config.js.' });
        }

        await interaction.editReply({ content: `🔍 Scanning forum threads for cleanup (action: ${action})...` });

        let stats = {
            scanned: 0,
            followups: 0,
            closed: 0,
            errors: 0
        };

        // Initialize table for tracking follow-ups
        await initializeFollowupTable();

        for (const forumId of forumChannels) {
            const forum = await client.channels.fetch(forumId).catch(() => null);
            if (!forum || !forum.isThreadOnly()) continue;

            try {
                // Fetch active and archived threads
                const fetchedThreads = await forum.threads.fetchActive();
                const archivedThreads = await forum.threads.fetchArchived({ limit });

                const allThreads = [...fetchedThreads.threads.values(), ...archivedThreads.threads.values()]
                    .filter(thread => !thread.locked && !thread.archived)
                    .slice(0, limit);

                for (const thread of allThreads) {
                    stats.scanned++;

                    try {
                        // Fetch only the last message to check activity time
                        const lastMessageFetch = await thread.messages.fetch({ limit: 1 }).catch(() => null);
                        
                        let lastActiveTime = thread.createdTimestamp; // Fallback to thread creation time
                        if (lastMessageFetch && lastMessageFetch.size > 0) {
                            const lastMessage = lastMessageFetch.first();
                            lastActiveTime = lastMessage.createdTimestamp;
                        }
                        
                        const timeSinceLastActivity = Date.now() - lastActiveTime;
                        const daysSinceLastActivity = timeSinceLastActivity / (1000 * 60 * 60 * 24);

                        // Check if we've already sent a follow-up
                        const followupData = await getFollowupData(thread.id);

                        // Force-close threads 14+ days old
                        if ((action === 'close' || action === 'both') && daysSinceLastActivity >= 14) {
                            await closeThread(thread, true);
                            if (followupData) await removeFollowup(thread.id);
                            stats.closed++;
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue;
                        }

                        if ((action === 'followup' || action === 'both') && daysSinceLastActivity >= 7 && !followupData) {
                            // Send follow-up for threads inactive for 7+ days
                            await sendFollowupMessage(thread);
                            await recordFollowup(thread.id);
                            stats.followups++;
                            
                            // Rate limit delay
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }

                        if ((action === 'close' || action === 'both') && followupData) {
                            const timeSinceFollowup = Date.now() - followupData.followup_time;
                            const hoursSinceFollowup = timeSinceFollowup / (1000 * 60 * 60);

                            if (hoursSinceFollowup >= 24) {
                                // Fetch up to 20 messages to check for user responses after follow-up
                                const recentMessages = await thread.messages.fetch({ limit: 20 }).catch(() => null);
                                let userRespondedAfterFollowup = false;
                                
                                if (recentMessages && recentMessages.size > 0) {
                                    userRespondedAfterFollowup = recentMessages.some(m => 
                                        m.createdTimestamp > followupData.followup_time && !m.author.bot
                                    );
                                }

                                if (!userRespondedAfterFollowup) {
                                    // Close thread (lock and archive)
                                    await closeThread(thread);
                                    await removeFollowup(thread.id);
                                    stats.closed++;
                                    
                                    // Rate limit delay
                                    await new Promise(resolve => setTimeout(resolve, 1000));
                                }
                            }
                        }

                    } catch (err) {
                        error(`[CLEANUP] Error processing thread ${thread.id}:`, err);
                        stats.errors++;
                    }
                }
            } catch (err) {
                error(`[CLEANUP] Error fetching threads from forum ${forumId}:`, err);
                stats.errors++;
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('🧹 Support Cleanup Complete')
            .setDescription(`Finished processing forum threads.`)
            .addFields(
                { name: '📊 Threads Scanned', value: `${stats.scanned}`, inline: true },
                { name: '📬 Follow-ups Sent', value: `${stats.followups}`, inline: true },
                { name: '🔒 Threads Closed', value: `${stats.closed}`, inline: true },
                { name: '⚠️ Errors', value: `${stats.errors}`, inline: true }
            )
            .setColor('#2ecc71')
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed] });
    }
}).toJSON();

// Helper Functions

function initializeFollowupTable() {
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
        .setFooter({ text: 'Anomaly Support System' })
        .setTimestamp();

    const msg = await thread.send({ embeds: [embed] });
    await recordFollowup(thread.id, msg.id);
}

async function closeThread(thread, skipMessage = false) {
    if (!skipMessage) {
        const embed = new EmbedBuilder()
            .setTitle('🔒 Thread Closed - Inactivity')
            .setDescription(
                `This support thread has been automatically closed due to **24 hours of inactivity** after our follow-up.\n\n` +
                `If you still need assistance, feel free to create a new post or contact staff directly.`
            )
            .setColor('#95a5a6')
            .setFooter({ text: 'Anomaly Support System' })
            .setTimestamp();

        await thread.send({ embeds: [embed] });
    }
    
    // Lock and archive the thread
    await thread.setLocked(true);
    await thread.setArchived(true);
}
