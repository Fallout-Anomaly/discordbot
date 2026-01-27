const Component = require('../../structure/Component');
const { EmbedBuilder } = require('discord.js');

module.exports = new Component({
    customId: /^feedback_(worked|failed)_/,
    type: 'button',
    options: {
        public: false
    },
    run: async (client, interaction) => {
        // Already deferred by interactionCreate.js - use editReply()
        const customId = interaction.customId;
        const [, action, messageId] = customId.match(/^feedback_(worked|failed)_(.+)$/);

        try {
            // Get the original response message
            const originalMessage = await interaction.channel.messages.fetch(messageId).catch(() => null);
            if (!originalMessage) {
                return interaction.editReply({ 
                    content: '❌ Could not find the original message.' 
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
                responseEmbed
                    .addField('Next Steps', `<@&${staffRoleId}> - This user reports the solution didn't work. They may need additional assistance.`, false);
                
                responseContent = `<@&${staffRoleId}> User reports: Solution didn't work. Ready to assist with follow-up.`;
            } else {
                // If it worked, celebrate
                responseEmbed
                    .addField('Glad We Could Help!', 'If you encounter any other issues, feel free to ask!', false);
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
