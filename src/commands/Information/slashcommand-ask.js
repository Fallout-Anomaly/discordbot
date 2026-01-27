const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const AIService = require("../../utils/AIService");

module.exports = new ApplicationCommand({
    command: {
        name: 'ask',
        description: 'Ask the Anomaly AI a question about the modlist.',
        defer: true,
        options: [
            {
                name: 'query',
                type: ApplicationCommandOptionType.String,
                description: 'The question you want to ask.',
                required: true
            }
        ]
    },
    run: async (client, interaction) => {
        const question = interaction.options.getString('query');
        const history = [{ role: 'user', content: question }];

        // 1. Search Knowledge Base
        const contextItems = client.knowledge.search(question.toLowerCase());

        try {
            // 2. Generate Answer via AI
            const answer = await AIService.generateAnswer(question, contextItems, history);

            const embed = new EmbedBuilder()
                .setTitle('☢️ Anomaly Intelligence')
                .setDescription(`**Q:** ${question}\n\n${answer.substring(0, 4000)}`) // Discord limit safe
                .setColor('#2ecc71') // Green for "Command Success"
                .setFooter({ 
                    text: `Asked by ${interaction.user.username} • Sources: ${((contextItems || []).map(i => (i && (i.fullName || i.name || i.originalFile)) || (typeof i === 'string' ? i : 'Unknown')).join(', ')) || 'General Knowledge'}` 
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[ASK COMMAND] Error:', err);
            await interaction.editReply({ 
                content: '❌ I encountered an error while processing your request. Please try again later.' 
            });
        }
    }
}).toJSON();
