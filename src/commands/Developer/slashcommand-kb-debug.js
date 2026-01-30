const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'kb-debug',
        description: '[DEV] Debug knowledge base search for a query',
        options: [
            {
                name: 'query',
                description: 'What to search for in the knowledge base',
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    },
    run: async (client, interaction) => {
        // Admin/Dev only
        if (interaction.user.id !== process.env.OWNER_ID && !interaction.member?.permissions.has('ADMINISTRATOR')) {
            return interaction.reply({ 
                content: '❌ Dev command only.', 
                flags: 64 
            });
        }

        await interaction.deferReply();

        const query = interaction.options.getString('query');
        
        // Search knowledge base
        const results = client.knowledge.search(query);
        
        if (results.length === 0) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('📚 Knowledge Base Debug - No Results')
                        .setDescription(`**Query:** ${query}\n\n❌ No matching documents found in the knowledge base.`)
                        .setColor('#e74c3c')
                        .addFields(
                            { name: 'KB Status', value: `Loaded: ${client.knowledge.loaded}\nTotal Documents: ${client.knowledge.totalDocuments}` }
                        )
                ]
            });
        }

        // Show all results with scores
        const embed = new EmbedBuilder()
            .setTitle('📚 Knowledge Base Debug Results')
            .setDescription(`**Query:** ${query}\n**Results Found:** ${results.length}/${client.knowledge.totalDocuments}`)
            .setColor('#3498db');

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const preview = result.description.substring(0, 150).replace(/\n/g, ' ') + '...';
            
            embed.addFields({
                name: `#${i + 1} - ${result.fullName} (Score: ${Math.round(result.score)})`,
                value: `\`\`\`${preview}\`\`\``,
                inline: false
            });
        }

        embed.setFooter({ text: `KB loaded: ${client.knowledge.loaded} | Total docs: ${client.knowledge.totalDocuments}` });

        return interaction.editReply({ embeds: [embed] });
    }
}).toJSON();
