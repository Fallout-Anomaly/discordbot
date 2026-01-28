const { EmbedBuilder } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'ai-status',
        description: 'View the AI assistant\'s knowledge base status and capabilities'
    },
    run: async (client, interaction) => {
        await interaction.deferReply();

        const hasAIKey = !!process.env.GROQ_API_KEY;
        const kbLoaded = client.knowledge.loaded;
        const kbDocuments = client.knowledge.totalDocuments;

        const embed = new EmbedBuilder()
            .setTitle('🤖 Anomaly AI Assistant Status')
            .setColor(hasAIKey && kbLoaded ? '#2ecc71' : '#e74c3c')
            .addFields(
                {
                    name: '🧠 AI Model',
                    value: hasAIKey 
                        ? '✅ Groq Llama 3.1 8B (Active)' 
                        : '❌ No API Key - Using fallback responses',
                    inline: true
                },
                {
                    name: '📚 Knowledge Base',
                    value: kbLoaded 
                        ? `✅ Loaded (${kbDocuments} documents)` 
                        : '❌ Not loaded yet',
                    inline: true
                },
                {
                    name: '📖 What I Know About',
                    value: kbLoaded && kbDocuments > 0
                        ? '• **Fallout Anomaly** systems & mechanics\n• **Installation** guides & troubleshooting\n• **Controls** & gamepad setup\n• **MCM** configuration\n• **Perks, Traits, Power Armor**\n• **Economy & Scavenging**'
                        : '⚠️ Knowledge base not loaded',
                    inline: false
                },
                {
                    name: '💪 Capabilities',
                    value: '✅ Answer questions about Fallout Anomaly\n✅ Search documentation automatically\n✅ Provide step-by-step guides\n⚠️ Cannot read images or attachments\n⚠️ Cannot see your game settings/mods',
                    inline: false
                },
                {
                    name: '🔄 How to Help Me Improve',
                    value: '1. Use **✅ That Worked!** or **❌ That Didn\'t Work** buttons\n2. Staff can react with 🧠 to teach me new info\n3. Report gaps with `/report` command',
                    inline: false
                }
            )
            .setFooter({ text: 'Ask me anything about Fallout Anomaly!' });

        if (!hasAIKey) {
            embed.addFields({
                name: '⚠️ Warning',
                value: 'AI features are degraded - Groq API key not configured.'
            });
        }

        if (!kbLoaded) {
            embed.addFields({
                name: '⚠️ Warning',
                value: 'Knowledge base is still loading. Please try again in a moment.'
            });
        }

        return interaction.editReply({ embeds: [embed] });
    }
}).toJSON();
