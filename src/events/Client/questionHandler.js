const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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

        // For forum threads, respond to any message (starter or follow-ups)
        // This allows the bot to help with follow-up questions and clarifications

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
            let hasStaffResponse = false;
            const staffRoleId = config.roles?.staff_role || process.env.STAFF_ROLE_ID;
            
            if (isAskChannel || isForumThread) {
                try {
                    const historyMessages = await message.channel.messages.fetch({ limit: 20 }).catch(() => null);
                    if (historyMessages) {
                        // Check if a staff member has already provided a response
                        hasStaffResponse = historyMessages.some(m => {
                            if (m.author.bot) return false;
                            
                            // Check if the message author has the staff role
                            if (message.guild && m.member) {
                                return m.member.roles.has(staffRoleId);
                            }
                            return false;
                        });
                        
                        history = historyMessages
                            .filter(m => {
                                // Exclude the current message
                                if (m.id === message.id) return false;
                                
                                // ALWAYS include user's own messages
                                if (m.author.id === message.author.id) return true;
                                
                                // ALWAYS include bot's recent messages (to remember context)
                                if (m.author.id === client.user.id) return true;
                                
                                // Include staff responses for context
                                if (m.member && m.member.roles.cache.has(staffRoleId)) {
                                    return true;
                                }
                                
                                return false;
                            })
                            .reverse()
                            .map(m => {
                                const role = m.author.id === client.user.id ? 'assistant' : 'user';
                                let content = m.content;
                                if (!content && m.embeds && m.embeds.length > 0) {
                                    // Extract description from embed
                                    content = m.embeds[0].description || m.embeds[0].title || '[Embed]';
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

            // If staff already provided a detailed answer, only respond if this is a NEW clarifying question
            // Check if the current message is just repeating the original problem (not asking for clarification)
            const isRepeat = history.length > 0 && history.some(msg => {
                if (msg.role !== 'user') return false;
                // Check if current question is very similar to a previous user message
                const simWords = (msg.content || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
                const currWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
                const commonWords = simWords.filter(w => currWords.includes(w));
                return commonWords.length > 3; // Similarity threshold
            });

            if (hasStaffResponse && isRepeat) {
                // Don't respond - escalate to staff for follow-up
                await message.reply({
                    content: `<@&${config.roles?.staff_role || process.env.STAFF_ROLE_ID}> User is following up on this issue. A staff member has already responded.`,
                    embeds: []
                }).catch(err => {
                    error('[QUESTION HANDLER] Escalation reply error:', err);
                });
                return;
            }

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
                    replyContent = `<@&${staffRole}> This question requires staff assistance.`;
                }
            }

            // Create feedback buttons
            const feedbackRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`feedback_worked_${message.id}`)
                        .setLabel('✅ That Worked!')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`feedback_failed_${message.id}`)
                        .setLabel('❌ That Didn\'t Work')
                        .setStyle(ButtonStyle.Danger)
                );

            // Check if this is a new forum post (thread starter message)
            let isNewThreadStarter = false;
            if (isForumThread && message.channel.isThread()) {
                try {
                    const starterMessage = await message.channel.fetchStarterMessage().catch(() => null);
                    if (starterMessage && starterMessage.id === message.id) {
                        isNewThreadStarter = true;
                    }
                } catch (err) {
                    // Ignore errors fetching starter message
                }
            }

            // Add upload reminder for new support threads
            if (isNewThreadStarter) {
                const uploadReminder = `**📎 Please upload the following to help us assist you faster:**\n` +
                    `• **Save files** (from your save folder)\n` +
                    `• **Crash logs** (if applicable)\n` +
                    `• **Screenshots** of the issue\n\n`;
                
                if (!replyContent) {
                    replyContent = uploadReminder;
                } else {
                    replyContent = uploadReminder + replyContent;
                }
            }

            // Reply to message
            await message.reply({ content: replyContent, embeds: [embed], components: [feedbackRow] }).then(async (msg) => {
                // Reactions deprecated in favor of buttons, but keep for legacy support
                await msg.react('👍').catch(() => {}); 
                await msg.react('👎').catch(() => {});
            }).catch(err => {
                error('[QUESTION HANDLER] Reply Error:', err);
                // Fallback to sending in channel if reply fails (e.g. message deleted)
                message.channel.send({ embeds: [embed], components: [feedbackRow] }).catch(() => {});
            });

        } catch (err) {
            error('[QUESTION HANDLER] Error:', err);
        }
    }
}).toJSON();
