const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const AIService = require("../../utils/AIService");

module.exports = new ApplicationCommand({
    command: {
        name: 'ask',
        description: 'Ask a question about the Fallout Anomaly modpack.',
        options: [
            {
                name: 'question',
                description: 'Your question (e.g. "How do I install?")',
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    },
    run: async (client, interaction) => {
        const question = interaction.options.getString('question');

        await interaction.deferReply();

        try {
            // 1. Search Knowledge Base
            const contextItems = client.knowledge.search(question);

            if (contextItems.length === 0) {
                return interaction.editReply("I'm sorry, I couldn't find any information in my knowledge base relevant to your query. Please try different keywords or ask in the support channels.");
            }

            // 2. Refine question for better AI performance (Optional but in worker logic)
            // const refined = await AIService.refineQuestion(question);

            // 3. Generate Answer
            const answer = await AIService.generateAnswer(question, contextItems);

            const embed = new EmbedBuilder()
                .setTitle('☢️ Anomaly AI Assistant')
                .setDescription(answer.substring(0, 4096))
                .setColor('#3498db')
                .setFooter({ text: `Source context: ${contextItems.map(i => i.fullName).join(', ')}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error(err);
            await interaction.editReply(`❌ An error occurred: ${err.message}`);
        }
    }
}).toJSON();
