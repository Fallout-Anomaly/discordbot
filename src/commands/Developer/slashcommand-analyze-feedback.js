const { EmbedBuilder, ApplicationCommandOptionType, PermissionFlagsBits, ChannelType } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const db = require('../../utils/EconomyDB');
const AIService = require('../../utils/AIService');
const { error } = require('../../utils/Console');

module.exports = new ApplicationCommand({
    command: {
        name: 'analyze-feedback',
        description: 'Scan and analyze player feedback from the feedback channel',
        defaultMemberPermissions: PermissionFlagsBits.Administrator.toString(),
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
                description: 'Feedback channel to scan (optional)',
                type: ApplicationCommandOptionType.Channel,
                required: false,
                channelTypes: [ChannelType.GuildText]
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
        const action = interaction.options.getString('action');
        const limit = interaction.options.getInteger('limit') || 50;

        const selectedChannel = interaction.options.getChannel('channel');
        let feedbackChannel = selectedChannel;
        if (!feedbackChannel) {
            const feedbackChannelId = process.env.FEEDBACK_CHANNEL_ID;
            if (!feedbackChannelId) {
                return interaction.reply({ content: '❌ Feedback channel not configured. Provide the `channel` option when running this command or set FEEDBACK_CHANNEL_ID in .env.', flags: 64 });
            }
            feedbackChannel = await client.channels.fetch(feedbackChannelId).catch(() => null);
        }
        if (!feedbackChannel || feedbackChannel.type !== ChannelType.GuildText) {
            return interaction.reply({ content: '❌ Invalid or missing feedback channel. Please select a text channel.', flags: 64 });
        }

        if (action === 'scan') {
            await interaction.deferReply();

            try {
                const messages = await feedbackChannel.messages.fetch({ limit });
                let scanned = 0;
                let stored = 0;

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
                    .setDescription(`Scanned **${scanned}** messages and stored **${stored}** new feedback entries.`)
                    .setColor('#3498DB')
                    .setFooter({ text: 'Use /analyze-feedback summary to view results' });

                return interaction.editReply({ embeds: [embed] });
            } catch (err) {
                error('[FEEDBACK SCAN]', err);
                return interaction.editReply({ content: `❌ Error scanning feedback: ${err.message}` });
            }
        }

        if (action === 'summary') {
            await interaction.deferReply();

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
            await interaction.deferReply();

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
                if (err) return interaction.reply({ content: `❌ Error clearing database: ${err.message}`, flags: 64 });
                interaction.reply({ content: '✅ Feedback database cleared.', flags: 64 });
            });
        }
    }
}).toJSON();
