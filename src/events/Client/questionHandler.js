const { Events, EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');
const AIService = require('../../utils/AIService');
const AutoResponder = require('../../utils/AutoResponder');
const config = require('../../config');
const { info, error } = require('../../utils/Console');

module.exports = new Event({
    event: Events.MessageCreate,
    once: false,
    run: async (client, message) => {
        // Basic checks - ignore bots and DM
        if (message.author.bot || !message.guild) return;
        
        const askChannelId = process.env.ASK_CHANNEL_ID;
        const forumChannels = config.channels.forum_support || [];

        // Check if we are in the designated AI channel
        const isAskChannel = message.channel.id === askChannelId;
        
        // Check if we are in a forum thread (check parent channel ID)
        const isForumThread = message.channel.isThread() && forumChannels.includes(message.channel.parentId);

        // If it's neither, we might still want to respond if the bot is mentioned
        const isMentioned = message.mentions.has(client.user.id) && !message.mentions.everyone;

        if (!isAskChannel && !isForumThread && !isMentioned) return;

        // info(`[DEBUG] Handling message: "${message.content}" in channel ${message.channel.id} (Ask: ${isAskChannel}, Forum: ${isForumThread}, Mention: ${isMentioned})`);

        // For forum threads, we generally only want to answer the first message/starter
        if (isForumThread) {
            // Check if this is the starter message of the thread
            // Note: message.id !== message.channel.id; instead use position === 0
            const isStarter = message.position === 0;
            if (!isStarter) return;
        }

        // Avoid replying if the user is replying to someone else (unless it's the bot)
        if (message.reference) {
            try {
                const repliedMessage = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
                if (repliedMessage && repliedMessage.author.id !== client.user.id) return; 
            } catch (err) {
                // Ignore fetch errors
            }
        }

        // Avoid tagging people unnecessarily (ignore if mentions has other users)
        const otherMentions = message.mentions.users.filter(u => u.id !== client.user.id);
        if (otherMentions.size > 0) return;

        // 0. Auto-Trigger Check (The "Smart" Layer)
        try {
            const handledByAuto = await AutoResponder.checkAndRespond(message);
            if (handledByAuto) return;
        } catch (autoErr) {
            error('[AUTO RESPONDER] Error:', autoErr);
        }

        // Start typing to show activity
        await message.channel.sendTyping().catch(() => {});

        try {
            const question = message.content;
            if (!question || question.length < 2) return;

            // Fetch recent history for conversational context (only if in the designated AI channel)
            let history = [];
            if (isAskChannel || isForumThread) {
                try {
                    const historyMessages = await message.channel.messages.fetch({ limit: 6 }).catch(() => null);
                    if (historyMessages) {
                        history = historyMessages
                            .filter(m => {
                                // Exclude the current message
                                if (m.id === message.id) return false;
                                
                                // Include user's own messages
                                if (m.author.id === message.author.id) return true;
                                
                                // Include bot messages ONLY if they are replies to this user's messages
                                if (m.author.id === client.user.id) {
                                    return m.reference && m.reference.messageId && 
                                           historyMessages.some(hm => hm.id === m.reference.messageId && hm.author.id === message.author.id);
                                }
                                
                                return false;
                            })
                            .reverse()
                            .map(m => {
                                const role = m.author.id === client.user.id ? 'assistant' : 'user';
                                let content = m.content;
                                if (!content && m.embeds && m.embeds.length > 0) {
                                    content = m.embeds[0].description;
                                }
                                return { role, content: content || '[Attachment/Embed]' };
                            });
                    }
                } catch (histErr) {
                    // Ignore history fetch errors
                }
            }

            // 1. Search Knowledge Base
            const contextItems = client.knowledge.search(question.toLowerCase());

            // 2. Generate Answer via AI
            const result = await AIService.generateAnswer(question, contextItems, history);
            
            // Handle both old string format and new object format for backwards compatibility
            const answer = typeof result === 'string' ? result : result.answer;
            const needsEscalation = typeof result === 'object' && result.needsEscalation;

            const embed = new EmbedBuilder()
                .setTitle('☢️ Anomaly AI Assistant')
                .setDescription(answer.substring(0, 4096))
                .setColor(needsEscalation ? '#e67e22' : '#3498db')
                .setFooter({ text: `Sources: ${contextItems.map(i => i.fullName).join(', ') || 'General Knowledge'} • React 👍/👎 for feedback • Install: https://fallout-anomaly.github.io/websitedev/` })
                .setTimestamp();

            // Add escalation notice if needed
            let replyContent = null;
            if (needsEscalation) {
                const staffRole = config.roles?.staff_role || process.env.STAFF_ROLE_ID;
                if (staffRole) {
                    replyContent = `<@&${staffRole}> This question may require staff assistance.`;
                }
            }

            // Reply to message
            await message.reply({ content: replyContent, embeds: [embed] }).then(async (msg) => {
                // Add feedback reactions
                await msg.react('👍').catch(() => {}); 
                await msg.react('👎').catch(() => {});
            }).catch(err => {
                error('[QUESTION HANDLER] Reply Error:', err);
                // Fallback to sending in channel if reply fails (e.g. message deleted)
                message.channel.send({ embeds: [embed] }).catch(() => {});
            });

        } catch (err) {
            error('[QUESTION HANDLER] Error:', err);
        }
    }
}).toJSON();
