const { EmbedBuilder, ApplicationCommandOptionType, ChannelType } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const db = require('../../utils/EconomyDB');
const AIService = require('../../utils/AIService');
const { error } = require('../../utils/Console');
const config = require('../../config');

module.exports = new ApplicationCommand({
    command: {
        name: 'analyze-feedback',
        description: 'Scan and analyze player feedback from the feedback channel',
        defer: 'ephemeral', // IMPORTANT: Defer immediately to prevent 10062 Unknown interaction
        options: [
            {
                name: 'action',
                description: 'What to do',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { name: 'Scan Channel', value: 'scan' },
                    { name: 'Show Summary', value: 'summary' },
                    { name: 'Show Top Issues', value: 'issues' },
                    { name: 'Clear Database', value: 'clear' }
                ]
            },
            {
                name: 'channel',
                description: 'Feedback channel to scan (optional) - supports text or forum channels',
                type: ApplicationCommandOptionType.Channel,
                required: false,
                channelTypes: [ChannelType.GuildText, ChannelType.GuildForum]
            },
            {
                name: 'limit',
                description: 'Number of recent messages to scan (default: 50)',
                type: ApplicationCommandOptionType.Integer,
                required: false
            }
        ]
    },
    run: async (client, interaction) => {
        // Owner-only check
        if (interaction.user.id !== config.users.ownerId) {
            return interaction.editReply({ content: config.messages.NOT_BOT_OWNER });
        }

        const action = interaction.options.getString('action');
        const limit = interaction.options.getInteger('limit') || 50;

        const selectedChannel = interaction.options.getChannel('channel');
        let feedbackChannel = selectedChannel;
        
        if (!feedbackChannel) {
            const feedbackChannelId = process.env.FEEDBACK_CHANNEL_ID;
            if (!feedbackChannelId) {
                return interaction.editReply({ content: '❌ Feedback channel not configured. Provide the `channel` option when running this command or set FEEDBACK_CHANNEL_ID in .env.' });
            }
            try {
                feedbackChannel = await client.channels.fetch(feedbackChannelId);
            } catch (err) {
                error('[FEEDBACK] Channel fetch error:', err);
                return interaction.editReply({ content: `❌ Unable to access feedback channel (${feedbackChannelId}). Please check if the channel exists and the bot has permission to access it.` });
            }
        }
        
        if (!feedbackChannel) {
            return interaction.editReply({ content: '❌ Feedback channel not found. Please select a valid text channel.' });
        }
        
        // Check if channel is a text-based channel OR forum channel
        const isTextChannel = feedbackChannel.isTextBased?.();
        const isForumChannel = feedbackChannel.type === ChannelType.GuildForum;
        
        if (!isTextChannel && !isForumChannel) {
            return interaction.editReply({ content: `❌ Invalid channel type. The feedback channel must be a text or forum channel, but <#${feedbackChannel.id}> is type ${feedbackChannel.type}.` });
        }

        if (action === 'scan') {
            try {
                let messages = new Map();
                
                // Handle forum channels differently - fetch from threads
                if (isForumChannel) {
                    try {
                        const threadsCollection = await feedbackChannel.threads.fetchActive();
                        
                        // Convert collection to array of threads and iterate
                        const threadArray = Array.from(threadsCollection.values());
                        
                        if (threadArray.length === 0) {
                            return interaction.editReply({ content: '❌ No active threads found in the forum channel. The forum may be empty.' });
                        }
                        
                        for (const thread of threadArray) {
                            try {
                                const threadMessages = await thread.messages.fetch({ limit });
                                if (threadMessages && threadMessages.size > 0) {
                                    for (const msg of threadMessages.values()) {
                                        messages.set(msg.id, msg);
                                        if (messages.size >= limit) break;
                                    }
                                }
                                if (messages.size >= limit) break;
                            } catch (threadErr) {
                                error('[FEEDBACK] Thread message fetch error:', threadErr);
                                // Continue to next thread if one fails
                            }
                        }
                    } catch (forumErr) {
                        error('[FEEDBACK] Forum channel error:', forumErr);
                        return interaction.editReply({ content: `❌ Error scanning forum channel: ${forumErr.message}` });
                    }
                } else {
                    // Handle text channels - fetch directly
                    messages = await feedbackChannel.messages.fetch({ limit });
                }
                
                let scanned = 0;
                let stored = 0;

                // Show the channel being scanned
                const scanInfo = new EmbedBuilder()
                    .setTitle('📡 Scanning Feedback Channel')
                    .setDescription(`Channel: <#${feedbackChannel.id}>\nLimit: ${limit} messages`)
                    .setColor('#3498DB');

                await interaction.editReply({ embeds: [scanInfo] });

                for (const [, message] of messages) {
                    if (message.author.bot || !message.content) continue;

                    scanned++;

                    // Check if already in database
                    const existing = await new Promise((resolve) => {
                        db.get('SELECT id FROM feedback WHERE message_id = ?', [message.id], (err, row) => {
                            resolve(row);
                        });
                    });

                    if (existing) continue;

                    // Categorize using AI
                    let category = 'General Feedback';
                    let theme = 'Other';

                    try {
                        const categorization = await AIService.generateAnswer(
                            `Categorize this feedback into ONE category: Bug Report, Feature Request, Balance Issue, Performance Issue, Gameplay, or Other.\n\nFeedback: "${message.content}"`,
                            [],
                            []
                        );

                        if (categorization.includes('Bug')) category = 'Bug Report';
                        else if (categorization.includes('Feature')) category = 'Feature Request';
                        else if (categorization.includes('Balance')) category = 'Balance Issue';
                        else if (categorization.includes('Performance')) category = 'Performance Issue';
                        else if (categorization.includes('Gameplay')) category = 'Gameplay';
                        else category = 'General Feedback';

                        // Extract theme
                        const lowerContent = message.content.toLowerCase();
                        if (lowerContent.includes('crash') || lowerContent.includes('error') || lowerContent.includes('bug')) {
                            theme = 'Stability';
                        } else if (lowerContent.includes('mod') || lowerContent.includes('feature')) {
                            theme = 'Mods & Content';
                        } else if (lowerContent.includes('balance') || lowerContent.includes('nerf') || lowerContent.includes('buff')) {
                            theme = 'Balance';
                        } else if (lowerContent.includes('early') || lowerContent.includes('new')) {
                            theme = 'Early Game';
                        } else if (lowerContent.includes('fps') || lowerContent.includes('lag') || lowerContent.includes('performance')) {
                            theme = 'Performance';
                        } else if (lowerContent.includes('quest') || lowerContent.includes('story')) {
                            theme = 'Quests & Story';
                        } else {
                            theme = 'General';
                        }
                    } catch (aiErr) {
                        error('[FEEDBACK] AI categorization error:', aiErr);
                    }

                    // Store in database
                    await new Promise((resolve) => {
                        db.run(
                            'INSERT INTO feedback (message_id, author_id, author_name, content, category, theme, timestamp, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                            [message.id, message.author.id, message.author.username, message.content, category, theme, message.createdTimestamp, Date.now()],
                            (err) => {
                                if (!err) stored++;
                                resolve();
                            }
                        );
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('📊 Feedback Scan Complete')
                    .setDescription(`**Channel:** <#${feedbackChannel.id}>\n\nScanned **${scanned}** messages and stored **${stored}** new feedback entries.`)
                    .setColor('#3498DB')
                    .setFooter({ text: 'Use /analyze-feedback summary to view results' });

                return interaction.editReply({ embeds: [embed] });
            } catch (err) {
                error('[FEEDBACK SCAN]', err);
                return interaction.editReply({ content: `❌ Error scanning feedback: ${err.message}` });
            }
        }

        if (action === 'summary') {
            try {
                // Get all feedback
                const allFeedback = await new Promise((resolve) => {
                    db.all('SELECT content, category, theme FROM feedback ORDER BY fetched_at DESC', [], (err, rows) => {
                        resolve(rows || []);
                    });
                });

                if (allFeedback.length === 0) {
                    return interaction.editReply({ content: '❌ No feedback in database. Run `/analyze-feedback scan` first.' });
                }

                // Count categories and themes
                const categories = {};
                const themes = {};
                allFeedback.forEach((fb) => {
                    categories[fb.category] = (categories[fb.category] || 0) + 1;
                    themes[fb.theme] = (themes[fb.theme] || 0) + 1;
                });

                // Get AI summary
                const feedbackText = allFeedback.map(fb => `[${fb.category}] ${fb.content}`).slice(0, 15).join('\n\n');
                let aiSummary = 'AI Summary pending...';

                try {
                    aiSummary = await AIService.generateAnswer(
                        `Provide a 3-4 sentence summary of this player feedback. Highlight key concerns and common themes:\n\n${feedbackText}`,
                        [],
                        []
                    );
                } catch (aiErr) {
                    error('[FEEDBACK] AI summary error:', aiErr);
                }

                const categoryText = Object.entries(categories)
                    .sort(([_a, countA], [_b, countB]) => countB - countA)
                    .map(([cat, count]) => `**${cat}**: ${count}`)
                    .join('\n');

                const themeText = Object.entries(themes)
                    .sort(([_a, countA], [_b, countB]) => countB - countA)
                    .map(([theme, count]) => `**${theme}**: ${count}`)
                    .slice(0, 5)
                    .join('\n');

                const embed = new EmbedBuilder()
                    .setTitle('📈 Feedback Analysis Summary')
                    .setDescription(aiSummary)
                    .addFields(
                        { name: 'Total Feedback Entries', value: `**${allFeedback.length}**`, inline: false },
                        { name: 'Categories', value: categoryText || 'None', inline: true },
                        { name: 'Top Themes', value: themeText || 'None', inline: true }
                    )
                    .setColor('#2ECC71')
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            } catch (err) {
                error('[FEEDBACK SUMMARY]', err);
                return interaction.editReply({ content: `❌ Error generating summary: ${err.message}` });
            }
        }

        if (action === 'issues') {
            try {
                // Get bug reports and issues
                const issues = await new Promise((resolve) => {
                    db.all(
                        'SELECT content, category, theme, author_name FROM feedback WHERE category IN ("Bug Report", "Balance Issue", "Performance Issue") ORDER BY fetched_at DESC LIMIT 10',
                        [],
                        (err, rows) => resolve(rows || [])
                    );
                });

                if (issues.length === 0) {
                    return interaction.editReply({ content: '✅ No reported issues found!' });
                }

                const issueText = issues
                    .map((issue, i) => `**${i + 1}. [${issue.category}]** ${issue.content.substring(0, 100)}...\n   *- ${issue.author_name}*`)
                    .join('\n\n');

                const embed = new EmbedBuilder()
                    .setTitle('🚨 Top Reported Issues')
                    .setDescription(issueText)
                    .addFields(
                        { name: 'Total Issues Logged', value: `${issues.length}`, inline: true }
                    )
                    .setColor('#E74C3C')
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            } catch (err) {
                error('[FEEDBACK ISSUES]', err);
                return interaction.editReply({ content: `❌ Error fetching issues: ${err.message}` });
            }
        }

        if (action === 'clear') {
            await db.run('DELETE FROM feedback', [], (err) => {
                if (err) return interaction.editReply({ content: `❌ Error clearing database: ${err.message}` });
                interaction.editReply({ content: '✅ Feedback database cleared.' });
            });
        }
    }
}).toJSON();
