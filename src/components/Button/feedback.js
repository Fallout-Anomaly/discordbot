const Component = require('../../structure/Component');
const { EmbedBuilder } = require('discord.js');

module.exports = new Component({
    customId: /^feedback_(worked|failed)_/,
    type: 'button',
    options: {
        public: true
    },
    run: async (client, interaction) => {
        // Defer interaction
        await interaction.deferReply({ flags: 64 });
        const customId = interaction.customId;
        const [, action, messageId] = customId.match(/^feedback_(worked|failed)_(.+)$/);

        try {
            // Get the original response message (the user's question message)
            const originalMessage = await interaction.channel.messages.fetch(messageId).catch(() => null);
            if (!originalMessage) {
                return interaction.editReply({ 
                    content: '❌ Could not find the original message.' 
                });
            }

            // Verify that the user clicking is the one who asked the question
            if (originalMessage.author.id !== interaction.user.id) {
                // We must use followUp because we already deferredUpdate (which targets the message), 
                // but we want to tell the clicked user "No" without ruining the interface.
                return interaction.followUp({ 
                    content: '❌ Only the user who asked the question can provide feedback.',
                    flags: 64
                });
            }

            // Determine if solution worked or not
            const didWork = action === 'worked';
            const statusEmoji = didWork ? '✅' : '❌';
            const actionText = didWork ? 'worked' : 'didn\'t work';

            // Get staff role for escalation if needed
            const config = require('../../config');
            const staffRoleId = config.roles?.staff_role || process.env.STAFF_ROLE_ID;

            // Create response embed
            const responseEmbed = new EmbedBuilder()
                .setTitle(`${statusEmoji} Solution Feedback Recorded`)
                .setDescription(`You indicated that the solution **${actionText}** for you.`)
                .setColor(didWork ? '#2ecc71' : '#e74c3c')
                .setFooter({ text: 'Thank you for the feedback!' });

            let responseContent = null;

            if (!didWork) {
                // If it didn't work, escalate to staff
                responseEmbed.addFields({ 
                    name: 'Next Steps', 
                    value: `<@&${staffRoleId}> - This user reports the solution didn't work. They may need additional assistance.`, 
                    inline: false 
                });
                
                responseContent = `<@&${staffRoleId}> User reports: Solution didn't work. Ready to assist with follow-up.`;
            } else {
                // If it worked, celebrate
                responseEmbed.addFields({ 
                    name: 'Glad We Could Help!', 
                    value: 'If you encounter any other issues, feel free to ask!', 
                    inline: false 
                });
            }

            // Reply with feedback recorded
            await interaction.editReply({ 
                content: responseContent,
                embeds: [responseEmbed],
                components: []
            });

            // Log the feedback for analytics
            if (originalMessage.author.id === client.user.id && originalMessage.embeds.length > 0) {
                const sourceEmbed = originalMessage.embeds[0];
                console.log(`[FEEDBACK] Solution ${actionText}: "${sourceEmbed.title}" for user ${interaction.user.username}`);
            }

        } catch (err) {
            console.error('[FEEDBACK BUTTON] Error:', err);
            await interaction.editReply({ 
                content: '❌ Error processing feedback.',
                components: []
            });
        }
    }
});
