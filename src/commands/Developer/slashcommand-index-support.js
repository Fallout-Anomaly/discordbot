const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");
const AIService = require("../../utils/AIService");
const AutoResponder = require("../../utils/AutoResponder");
const config = require("../../config");
const { error } = require("../../utils/Console");

module.exports = new ApplicationCommand({
    command: {
        name: 'index-support',
        description: 'Scan the last 30 forum threads and respond to unanswered questions (Staff Only).',
        defer: 'ephemeral',
        options: [
            {
                name: 'limit',
                description: 'Number of threads to scan (default 30, max 50).',
                type: ApplicationCommandOptionType.Integer,
                required: false
            }
        ]
    },
    options: {
        botOwner: true
    },
    run: async (client, interaction) => {
        // Permission check handled by botOwner flag above


        const limit = interaction.options.getInteger('limit') || 30;
        const scanLimit = Math.min(limit, 50);

        const forumChannels = config.channels.forum_support || [];
        if (forumChannels.length === 0) {
            return interaction.editReply({ content: '❌ No forum support channels configured in config.js.' });
        }

        await interaction.editReply({ content: '🔍 Scanning forum threads...' });

        let totalProcessed = 0;
        let totalReplied = 0;

        for (const forumId of forumChannels) {
            const forum = await client.channels.fetch(forumId).catch(() => null);
            if (!forum || !forum.isThreadOnly()) continue;

            const fetchedThreads = await forum.threads.fetchActive();
            const archivedThreads = await forum.threads.fetchArchived({ limit: scanLimit });
            
            // Combine and sort by creation date (simplified)
            const allThreads = [...fetchedThreads.threads.values(), ...archivedThreads.threads.values()]
                .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
                .slice(0, scanLimit);

            for (const thread of allThreads) {
                totalProcessed++;
                
                try {
                    // Fetch messages to see if bot already responded
                    const messages = await thread.messages.fetch({ limit: 20 });
                    const botResponded = messages.some(m => m.author.id === client.user.id);

                    if (botResponded) continue;

                    // Fetch the starter message
                    const starterMessage = await thread.fetchStarterMessage().catch(() => null);
                    if (!starterMessage || starterMessage.author.bot) continue;

                    const question = starterMessage.content;
                    if (!question || question.length < 5) continue;

                    // 1. Auto-Trigger Check
                    const handledByAuto = await AutoResponder.checkAndRespond(starterMessage).catch(() => false);
                    if (handledByAuto) {
                        totalReplied++;
                        continue;
                    }

                    // 2. AI Response
                    const contextItems = client.knowledge.search(question.toLowerCase());
                    const answer = await AIService.generateAnswer(question, contextItems, []);

                    const embed = new EmbedBuilder()
                        .setTitle('☢️ Anomaly Support - Archivist Handled')
                        .setDescription(answer.substring(0, 4000))
                        .setColor('#3498db')
                        .setFooter({ text: `Sources: ${contextItems.map(i => i.fullName).join(', ') || 'General Knowledge'} • React 👍/👎 for feedback • Install: https://fallout-anomaly.github.io/websitedev/` })
                        .setTimestamp();

                    await starterMessage.reply({ embeds: [embed] }).then(async (msg) => {
                        await msg.react('👍').catch(() => {});
                        await msg.react('👎').catch(() => {});
                    });

                    totalReplied++;
                    // Small delay to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 1500));

                } catch (err) {
                    error(`[INDEXING] Error in thread ${thread.id}:`, err);
                }
            }
        }

        await interaction.editReply({ 
            content: `✅ Done! Scanned **${totalProcessed}** threads across configured forums. Sent **${totalReplied}** new responses.` 
        });
    }
}).toJSON();
