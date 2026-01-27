const { ApplicationCommandOptionType, ChannelType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");
const db = require("../../utils/EconomyDB");

module.exports = new ApplicationCommand({
    command: {
        name: 'reset-support-followup',
        description: 'Clear follow-up tracking for a support thread (allows it to respond fresh).',
        options: [
            {
                name: 'thread',
                description: 'The support thread to reset',
                type: ApplicationCommandOptionType.Channel,
                channel_types: [ChannelType.PublicThread, ChannelType.PrivateThread],
                required: true
            }
        ]
    },
    options: {
        botOwner: true
    },
    run: async (client, interaction) => {
        const thread = interaction.options.getChannel('thread');

        if (!thread.isThread()) {
            return interaction.reply({ 
                content: '❌ That is not a thread. Please select a support thread.', 
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
