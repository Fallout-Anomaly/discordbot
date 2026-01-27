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

            // 1. Search Knowledge Base
            const contextItems = client.knowledge.search(question);

            if (contextItems.length === 0) {
                // Optional: Only reply if we find something, OR reply with a friendly "not found"
                // For "just typing" channels, it's usually better to reply.
                return message.reply("I'm sorry, I couldn't find any information in my knowledge base relevant to your question. Try using different keywords!").catch(console.error);
            }

            // 2. Generate Answer via AI
            const answer = await AIService.generateAnswer(question, contextItems);

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
