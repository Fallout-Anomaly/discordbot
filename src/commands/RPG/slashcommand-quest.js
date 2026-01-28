const db = require('../../utils/EconomyDB');
const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");
const AIService = require('../../utils/AIService');

// Quest templates for variety (fallback if AI is down)
const QUEST_TEMPLATES = [
    { title: "Clear the Dunwich Borers", description: "Radroach infestation spreading. We need that cleaned out.", objective: "Exterminate the infestation", difficulty: "Easy" },
    { title: "Retrieve Pre-War Tech", description: "An old robotics facility still has valuable tech. Go salvage what you can.", objective: "Collect pre-war artifacts", difficulty: "Medium" },
    { title: "Eliminate Raider Gang", description: "Slavers have been terrorizing settlements. Deal with them.", objective: "Neutralize the raider threat", difficulty: "Hard" },
    { title: "Investigate Missing Supplies", description: "Our supply caravan never returned. Find out what happened.", objective: "Track down the caravan", difficulty: "Medium" },
    { title: "Secure Water Purification", description: "The water pump is failing. We need parts to repair it.", objective: "Gather pump components", difficulty: "Easy" },
    { title: "Scout New Territory", description: "We're expanding. Check out that unexplored sector for threats.", objective: "Survey the area safely", difficulty: "Medium" },
    { title: "Destroy Synth Nest", description: "Institute infiltrators have been spotted. Take them out before they replace us.", objective: "Destroy all Synths", difficulty: "Hard" },
    { title: "Escort the Brahmin", description: "A trader needs help moving stock through super mutant territory.", objective: "Protect the caravan", difficulty: "Medium" }
];

module.exports = new ApplicationCommand({
    command: {
        name: 'questjournal',
        description: 'View and manage your quest journal.',
        options: [
            {
                name: 'status',
                description: 'Check your current active quest and journal stats.',
                type: ApplicationCommandOptionType.Subcommand
            },
            {
                name: 'generate',
                description: 'Generate a new radiant quest.',
                type: ApplicationCommandOptionType.Subcommand
            },
            {
                name: 'complete',
                description: 'Complete your current quest to claim rewards.',
                type: ApplicationCommandOptionType.Subcommand
            },
            {
                name: 'stats',
                description: 'View detailed quest completion statistics.',
                type: ApplicationCommandOptionType.Subcommand
            }
        ]
    },
    run: async (client, interaction) => {
        // FIX: Defer immediately. AI generation is slow.
        await interaction.deferReply({ flags: 64 });

        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        // --- STATUS (DEFAULT/MAIN) ---
        if (subcommand === 'status') {
            db.get('SELECT * FROM active_quests WHERE user_id = ?', [userId], (err, quest) => {
                if (err) return interaction.editReply({ content: '❌ Database error.' });
                
                if (!quest) {
                    // Show journal summary if no active quest
                    db.all('SELECT * FROM quest_history WHERE user_id = ?', [userId], (histErr, rows) => {
                        const stats = {
                            total: rows ? rows.length : 0,
                            easy: 0, medium: 0, hard: 0,
                            totalCaps: 0, totalXP: 0
                        };

                        if (rows) {
                            rows.forEach(q => {
                                if (q.difficulty === 'Easy') stats.easy++;
                                else if (q.difficulty === 'Medium') stats.medium++;
                                else if (q.difficulty === 'Hard') stats.hard++;
                                stats.totalCaps += q.reward_caps;
                                stats.totalXP += q.reward_xp;
                            });
                        }

                        const embed = new EmbedBuilder()
                            .setTitle('📓 Quest Journal')
                            .setDescription('No active quest. Your journal is empty, wasteland warrior.')
                            .addFields(
                                { name: '📈 Quests Completed', value: `${stats.total}`, inline: true },
                                { name: '🟢 Easy', value: `${stats.easy}`, inline: true },
                                { name: '🟡 Medium', value: `${stats.medium}`, inline: true },
                                { name: '🔴 Hard', value: `${stats.hard}`, inline: true },
                                { name: '💰 Total Caps', value: `${stats.totalCaps}`, inline: true },
                                { name: '✨ Total XP', value: `${stats.totalXP}`, inline: true },
                                { name: '⚡ Average Reward', value: stats.total > 0 ? `${Math.round(stats.totalCaps / stats.total)} Caps | ${Math.round(stats.totalXP / stats.total)} XP` : 'N/A', inline: false }
                            )
                            .setColor('#34495E')
                            .setFooter({ text: 'Use /questjournal generate to find work.' });

                        interaction.editReply({ embeds: [embed] });
                    });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setTitle(`📜 Active Quest: ${quest.title}`)
                    .setDescription(quest.description)
                    .addFields(
                        { name: 'Objective', value: quest.objective, inline: false },
                        { name: 'Difficulty', value: quest.difficulty, inline: true },
                        { name: 'Priority', value: quest.difficulty === 'Hard' ? '🔴 Critical' : quest.difficulty === 'Medium' ? '🟡 Important' : '🟢 Routine', inline: true },
                        { name: 'Rewards', value: `💰 ${quest.reward_caps} Caps | ✨ ${quest.reward_xp} XP` + (quest.reward_item ? ` | 🎁 ${quest.reward_item}` : ''), inline: false }
                    )
                    .setColor('#f1c40f')
                    .setFooter({ text: 'Use /questjournal complete when finished.' });

                interaction.editReply({ embeds: [embed] });
            });
        }

        // --- GENERATE ---
        else if (subcommand === 'generate') {
            // Check cooldown or existing quest
            db.get('SELECT * FROM active_quests WHERE user_id = ?', [userId], async (err, existingQuest) => {
                if (existingQuest) {
                    return interaction.editReply({ content: `❌ You already have an active quest: **${existingQuest.title}**. Finish it first!` });
                }

                // Get user stats for AI context
                const userParams = await new Promise((resolve) => {
                    db.get('SELECT level, stat_strength, stat_intelligence FROM users WHERE id = ?', [userId], (e, r) => resolve(r || {}));
                });

                // Generate Quest (AI or Template)
                let newQuest;
                try {
                    // Try AI generation if configured, otherwise template
                    if (process.env.GROQ_API_KEY && Math.random() > 0.3) {
                        newQuest = await AIService.generateQuest(userParams);
                    }
                    
                    if (!newQuest || !newQuest.title) {
                        // Fallback to template
                        const template = QUEST_TEMPLATES[Math.floor(Math.random() * QUEST_TEMPLATES.length)];
                        newQuest = { ...template };
                        // Randomize rewards slightly
                        newQuest.reward_caps = (template.difficulty === 'Hard' ? 150 : template.difficulty === 'Medium' ? 100 : 50) + Math.floor(Math.random() * 20);
                        newQuest.reward_xp = (template.difficulty === 'Hard' ? 100 : template.difficulty === 'Medium' ? 75 : 40);
                    } else {
                        // Ensure rewards exist if AI forgot them
                        if (!newQuest.reward_caps) newQuest.reward_caps = 100;
                        if (!newQuest.reward_xp) newQuest.reward_xp = 50;
                    }

                } catch (e) {
                    console.error("Quest Gen Error:", e);
                    return interaction.editReply({ content: '❌ Failed to generate quest docket. The terminal is glitching.' });
                }

                // Insert into DB
                db.run(`INSERT INTO active_quests (user_id, title, description, objective, difficulty, reward_caps, reward_xp, reward_item) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userId, newQuest.title, newQuest.description, newQuest.objective, newQuest.difficulty, newQuest.reward_caps, newQuest.reward_xp, newQuest.reward_item || null],
                    (err) => {
                        if (err) return interaction.editReply({ content: '❌ Failed to save quest to Pip-Boy database.' });

                        const embed = new EmbedBuilder()
                            .setTitle('🆕 New Quest Received')
                            .setDescription(`**${newQuest.title}**\n${newQuest.description}`)
                            .addFields(
                                { name: 'Objective', value: newQuest.objective, inline: true },
                                { name: 'Difficulty', value: newQuest.difficulty, inline: true },
                                { name: 'Rewards', value: `💰 ${newQuest.reward_caps} Caps\n✨ ${newQuest.reward_xp} XP` + (newQuest.reward_item ? `\n🎁 ${newQuest.reward_item}` : '') }
                            )
                            .setColor('#2ecc71');

                        interaction.editReply({ embeds: [embed] });
                    }
                );
            });
        }

        // --- COMPLETE ---
        else if (subcommand === 'complete') {
            // First fetch the quest to know rewards
            db.get('SELECT * FROM active_quests WHERE user_id = ?', [userId], (err, quest) => {
                if (!quest) return interaction.editReply({ content: '❌ You do not have an active quest to complete.' });

                // Safe Deletion: Only reward if we successfully delete
                db.run('DELETE FROM active_quests WHERE user_id = ?', [userId], function (delErr) {
                    if (delErr) return interaction.editReply({ content: '❌ Database error completing quest.' });
                    
                    if (this.changes === 0) {
                        return interaction.editReply({ content: '❌ Quest already completed or invalid.' });
                    }

                    // Grant Rewards
                    db.run('UPDATE users SET balance = balance + ?, xp = xp + ?, daily_quest_count = daily_quest_count + 1 WHERE id = ?', 
                        [quest.reward_caps, quest.reward_xp, userId]);

                    // Grant Item if exists
                    if (quest.reward_item) {
                        // Using UPSERT logic for items
                        db.run('INSERT INTO inventory (user_id, item_id, amount) VALUES (?, ?, 1) ON CONFLICT(user_id, item_id) DO UPDATE SET amount = amount + 1', [userId, quest.reward_item], (upErr) => {
                            if (upErr) {
                                // Fallback for older sqlite
                                db.get('SELECT amount FROM inventory WHERE user_id = ? AND item_id = ?', [userId, quest.reward_item], (e, row) => {
                                    if (row) db.run('UPDATE inventory SET amount = amount + 1 WHERE user_id = ? AND item_id = ?', [userId, quest.reward_item]);
                                    else db.run('INSERT INTO inventory (user_id, item_id, amount) VALUES (?, ?, 1)', [userId, quest.reward_item]);
                                });
                            }
                        });
                    }

                    // Archive to history (for stats)
                    db.run('INSERT INTO quest_history (user_id, difficulty, reward_caps, reward_xp, timestamp) VALUES (?, ?, ?, ?, ?)',
                        [userId, quest.difficulty, quest.reward_caps, quest.reward_xp, Date.now()], (_histErr) => {
                            // ignore errors, just stats
                        }
                    );

                    const embed = new EmbedBuilder()
                        .setTitle('🎉 Quest Complete!')
                        .setDescription(`You successfully completed: **${quest.title}**\n\n**Rewards:**\n💰 ${quest.reward_caps} Caps\n✨ ${quest.reward_xp} XP` + (quest.reward_item ? `\n🎁 **Item:** ${quest.reward_item}` : ''))
                        .setColor('#f1c40f');

                    interaction.editReply({ embeds: [embed] });
                });
            });
        }

        // --- STATS ---
        else if (subcommand === 'stats') {
            db.all('SELECT * FROM quest_history WHERE user_id = ?', [userId], (err, rows) => {
                const stats = {
                    total: rows ? rows.length : 0,
                    easy: 0, medium: 0, hard: 0,
                    totalCaps: 0, totalXP: 0
                };

                if (rows) {
                    rows.forEach(q => {
                        if (q.difficulty === 'Easy') stats.easy++;
                        else if (q.difficulty === 'Medium') stats.medium++;
                        else if (q.difficulty === 'Hard') stats.hard++;
                        stats.totalCaps += q.reward_caps;
                        stats.totalXP += q.reward_xp;
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('📊 Quest Statistics')
                    .setDescription('Your quest completion history and achievements.')
                    .addFields(
                        { name: '📈 Total Quests Completed', value: `${stats.total}`, inline: true },
                        { name: '🟢 Easy Quests', value: `${stats.easy}`, inline: true },
                        { name: '🟡 Medium Quests', value: `${stats.medium}`, inline: true },
                        { name: '🔴 Hard Quests', value: `${stats.hard}`, inline: true },
                        { name: '💰 Total Caps Earned', value: `${stats.totalCaps}`, inline: true },
                        { name: '✨ Total XP Earned', value: `${stats.totalXP}`, inline: true },
                        { name: '⚡ Average per Quest', value: stats.total > 0 ? `${Math.round(stats.totalCaps / stats.total)} Caps | ${Math.round(stats.totalXP / stats.total)} XP` : 'N/A', inline: false }
                    )
                    .setColor('#F39C12')
                    .setFooter({ text: 'Keep completing quests to build your legend!' });

                interaction.editReply({ embeds: [embed] });
            });
        }
    }
}).toJSON();
