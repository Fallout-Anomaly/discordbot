const triggers = require('../../../data/autoTriggers.json');
const { Events, EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');
const AIService = require('../../utils/AIService');

module.exports = new Event({
    event: Events.MessageCreate,
    once: false,
    run: async (client, message) => {
        // ... (previous ignored checks) ...
        if (message.author.bot || !message.guild) return;
        
        const askChannelId = process.env.ASK_CHANNEL_ID;
        if (!askChannelId || message.channel.id !== askChannelId) return;

        // ... (reply/mention checks) ...
        if (message.reference) {
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
            if (repliedMessage && repliedMessage.author.id !== client.user.id) return; 
        }

        const mentionedUsers = message.mentions.users.filter(u => u.id !== client.user.id);
        if (mentionedUsers.size > 0) return;

        await message.channel.sendTyping();

        try {
            const question = message.content.toLowerCase();

            // 0. Auto-Trigger Check (The "Smart" Layer)
            // Loops through predefined triggers to find keyword matches
            let triggeredResponse = null;
            for (const trigger of triggers) {
                // Must match ALL keywords in the list? Or ANY? 
                // Let's do a simple weighted match or "all" for strictness.
                // For "screen small corner", we want "screen" AND ("small" OR "corner" OR "upper").
                // Let's stick to "matches at least 2 keywords" for better accuracy?
                // Or just keep simple contains logic for now.
                
                // Let's try: if message matches critical keywords count >= 2 (if list > 1) or 1 (if list 1)
                const matches = trigger.keywords.filter(kw => question.includes(kw.toLowerCase())).length;
                if (matches >= 2 || (trigger.keywords.length === 1 && matches === 1)) {
                    triggeredResponse = trigger.response;
                    break;
                }
            }

            if (triggeredResponse) {
                // Send fast Triggered Response
                 const embed = new EmbedBuilder()
                    .setTitle('⚡ Anomaly Auto-Support')
                    .setDescription(triggeredResponse)
                    .setColor('#e74c3c') // Different color for auto-trigger
                    .setFooter({ text: 'This represents a known common issue. If this doesn\'t help, ask a staff member.' })
                    .setTimestamp();
                
                 await message.reply({ embeds: [embed] });
                 // Add checkmark to original message
                 await message.react('⚡');
                 return; // SKIP AI
            }

            const historyMessages = await message.channel.messages.fetch({ limit: 6 });
            // ... (rest of AI flow) ...
            const history = historyMessages
                .filter(m => m.id !== message.id) 
                .reverse()
                .map(m => {
                    const role = m.author.id === client.user.id ? 'assistant' : 'user';
                    let content = m.content;
                    if (!content && m.embeds && m.embeds.length > 0) {
                        content = m.embeds[0].description;
                    }
                    return { role, content: content || '[Attachment/Embed]' };
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
                .setDescription(answer.substring(0, 4096))
                .setColor('#3498db')
                .setFooter({ text: `React 👍 or 👎 to provide feedback • Sources: ${contextItems.map(i => i.fullName).join(', ')}` })
                .setTimestamp();

            // Handle system messages (cannot reply to them)
            let sentMessage;
            if (message.system) {
                 sentMessage = await message.channel.send({ embeds: [embed] });
            } else {
                 sentMessage = await message.reply({ embeds: [embed] });
            }

            // Add feedback reactions
            await sentMessage.react('👍'); // Good
            await sentMessage.react('👎'); // Bad

        } catch (err) {
            console.error('[QUESTION HANDLER] Error:', err);
            // Don't spam the channel with errors for every message, but maybe a subtle one
            // await message.reply("❌ I encountered an error while processing your question.");
        }
    }
}).toJSON();
