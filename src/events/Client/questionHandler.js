const { Events, EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');
const AIService = require('../../utils/AIService');

module.exports = new Event({
    event: Events.MessageCreate,
    once: false,
    run: async (client, message) => {
        // Ignore bots and messages outside the designated ask channel
        if (message.author.bot || !message.guild) return;
        
        const askChannelId = process.env.ASK_CHANNEL_ID;
        if (!askChannelId || message.channel.id !== askChannelId) return;

        // Visual feedback that the bot is "thinking"
        await message.channel.sendTyping();

        try {
            const question = message.content;

            // 1.5 Fetch Conversation History
            const historyMessages = await message.channel.messages.fetch({ limit: 5 });
            const history = historyMessages.reverse().map(m => {
                const role = m.author.id === client.user.id ? 'assistant' : 'user';
                // Clean content from mentions if needed, mostly just raw content is fine
                return { role, content: m.content || '[Attachment/Embed]' };
            });

            // 1. Search Knowledge Base (using only current question for search to keep it focused)
            const contextItems = client.knowledge.search(question);

            if (contextItems.length === 0) {
                 // Even if no context found, maybe the history has context? 
                 // We'll let it try to answer if it's a follow-up, or default fail.
                 // For now, let's allow it to proceed if it looks like a conversation.
            }

            // 2. Generate Answer via AI with History
            const answer = await AIService.generateAnswer(question, contextItems, history);

            const embed = new EmbedBuilder()
                .setTitle('☢️ Anomaly AI Assistant')
                .setDescription(answer.substring(0, 4090))
                .setColor('#3498db')
                .setFooter({ text: `Sources: ${contextItems.map(i => i.fullName).join(', ')}` })
                .setTimestamp();

            // Handle system messages (cannot reply to them)
            if (message.system) {
                 await message.channel.send({ embeds: [embed] });
            } else {
                 await message.reply({ embeds: [embed] });
            }

        } catch (err) {
            console.error('[QUESTION HANDLER] Error:', err);
            // Don't spam the channel with errors for every message, but maybe a subtle one
            // await message.reply("❌ I encountered an error while processing your question.");
        }
    }
}).toJSON();
