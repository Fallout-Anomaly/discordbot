const { ApplicationCommandOptionType, ChannelType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");
const db = require("../../utils/EconomyDB");
const config = require('../../config');

module.exports = new ApplicationCommand({
    command: {
        name: 'reset-support-followup',
        description: 'Clear follow-up tracking for a support thread (allows it to respond fresh).',
        options: [
            {
                name: 'thread',
                description: 'The support thread to reset (start typing to search)',
                type: ApplicationCommandOptionType.String,
                required: true,
                autocomplete: true
            }
        ]
    },
    options: {
        botOwner: true
    },
    autocomplete: async (client, interaction) => {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const forumChannels = config.channels.forum_support || [];
        
        let allThreads = [];
        
        // Fetch threads from all support forums
        for (const forumId of forumChannels) {
            const forum = await client.channels.fetch(forumId).catch(() => null);
            if (!forum || !forum.isThreadOnly()) continue;
            
            try {
                const activeThreads = await forum.threads.fetchActive();
                const archivedThreads = await forum.threads.fetchArchived({ limit: 25 });
                
                allThreads = allThreads.concat(
                    [...activeThreads.threads.values()],
                    [...archivedThreads.threads.values()]
                );
            } catch (err) {
                console.error('[RESET FOLLOWUP] Error fetching threads:', err);
            }
        }
        
        // Filter by search term
        const filtered = allThreads
            .filter(thread => thread.name.toLowerCase().includes(focusedValue))
            .slice(0, 25)
            .map(thread => ({
                name: `${thread.name} (${thread.archived ? 'Archived' : 'Active'})`,
                value: thread.id
            }));
        
        await interaction.respond(filtered);
    },
    run: async (client, interaction) => {
        const threadId = interaction.options.getString('thread');
        
        // Fetch the thread
        const thread = await client.channels.fetch(threadId).catch(() => null);
        
        if (!thread || !thread.isThread()) {
            return interaction.reply({ 
                content: '❌ Could not find that thread. Please try again.', 
                ephemeral: true 
            });
        }

        try {
            // Check if there's a follow-up record for this thread
            const followupData = await new Promise((resolve) => {
                db.get('SELECT * FROM support_followups WHERE thread_id = ?', [thread.id], (err, row) => {
                    resolve(row || null);
                });
            });

            if (!followupData) {
                return interaction.reply({ 
                    content: `✅ **No follow-up tracking found** for <#${thread.id}>.\n\nThis thread is not currently marked for follow-up.`, 
                    ephemeral: true 
                });
            }

            // Delete the follow-up record
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM support_followups WHERE thread_id = ?', [thread.id], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            return interaction.reply({ 
                content: `✅ **Follow-up tracking cleared** for <#${thread.id}>.\n\n🔄 The thread will now be treated fresh.\n⏰ If it remains inactive for 7+ days, it may receive a new follow-up.`, 
                ephemeral: true 
            });

        } catch (err) {
            console.error('[RESET FOLLOWUP] Error:', err);
            return interaction.reply({ 
                content: `❌ Error clearing follow-up tracking: ${err.message}`, 
                ephemeral: true 
            });
        }
    }
}).toJSON();
