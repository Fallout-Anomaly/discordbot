const db = require('../../utils/EconomyDB');
const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");
const AIService = require('../../utils/AIService');

module.exports = new ApplicationCommand({
    command: {
        name: 'quests',
        description: 'Manage your wasteland quests.',
        options: [
            {
                name: 'generate',
                description: 'Generate a new radiant quest.',
                type: ApplicationCommandOptionType.Subcommand
            },
            {
                name: 'status',
                description: 'Check your current active quest.',
                type: ApplicationCommandOptionType.Subcommand
            },
            {
                name: 'complete',
                description: 'Complete your current quest to claim rewards.',
                type: ApplicationCommandOptionType.Subcommand
            }
        ]
    },
    run: async (client, interaction) => {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        // --- STATUS ---
        if (subcommand === 'status') {
            db.get('SELECT * FROM active_quests WHERE user_id = ?', [userId], (err, quest) => {
                if (err) return interaction.reply({ content: '❌ Database error.', ephemeral: true });
                
                if (!quest) {
                    return interaction.reply({ 
                        content: 'You have no active quest. Use `/quest generate` to find one!', 
                        ephemeral: true 
                    });
                }

                const endTime = quest.start_time + (quest.duration * 60 * 1000);
                const isComplete = Date.now() >= endTime;
                const statusText = isComplete ? '✅ **Ready to Complete!** (Use `/quest complete`)' : `⏳ **In Progress** (Finishes <t:${Math.floor(endTime/1000)}:R>)`;

                const embed = new EmbedBuilder()
                    .setTitle(`📜 Current Quest: ${quest.title}`)
                    .setDescription(`*${quest.description}*\n\n**Objective:** ${quest.objective}`)
                    .addFields(
                        { name: 'Difficulty', value: quest.difficulty, inline: true },
                        { name: 'Reward', value: `${quest.reward_caps} Caps, ${quest.reward_xp} XP`, inline: true },
                        { name: 'Status', value: statusText, inline: false }
                    )
                    .setColor(isComplete ? '#2ecc71' : '#f39c12')
                    .setFooter({ text: quest.title }); // Store title in footer as ID-like check if needed? Not needed really.

                interaction.reply({ embeds: [embed] });
            });
        }

        // --- GENERATE ---
        else if (subcommand === 'generate') {
            await interaction.deferReply();

            db.get('SELECT * FROM active_quests WHERE user_id = ?', [userId], async (err, existingQuest) => {
                if (existingQuest) {
                    return interaction.editReply({ content: '❌ You already have an active quest! Finish or abandon it first.' }); // Abandon feature not implemented yet
                }

                // Get user info (level) for scaling
                db.get('SELECT xp FROM users WHERE id = ?', [userId], async (err, user) => {
                    const level = user ? Math.floor(Math.sqrt(user.xp / 100)) + 1 : 1;
                    
                    // Generate AI Quest
                    const questData = await AIService.generateQuest({ level: level, weapon: 'Unknown' });

                    // Calculate Rewards based on difficulty
                    let caps = 50;
                    let xp = 100;
                    let duration = 15; // minutes

                    if (questData.difficulty === 'Medium') { caps = 120; xp = 250; duration = 30; }
                    if (questData.difficulty === 'Hard') { caps = 300; xp = 500; duration = 60; }
                    
                    // Randomize slightly
                    caps = Math.floor(caps * (0.8 + Math.random() * 0.4));
                    const rewardItem = questData.reward_item || null;

                    const startTime = Date.now();

                    db.run(`INSERT INTO active_quests (user_id, title, description, objective, difficulty, reward_caps, reward_xp, start_time, duration, reward_item) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                        [userId, questData.title, questData.description, questData.objective, questData.difficulty, caps, xp, startTime, duration, rewardItem], 
                        (err) => {
                            if (err) {
                                // If column missing, try without reward_item (backward compatibility or migration needed)
                                console.error(err);
                                return interaction.editReply('❌ Failed to save quest to database. (DB Schema mismatch?)');
                            }

                            const embed = new EmbedBuilder()
                                .setTitle(`🆕 New Quest: ${questData.title}`)
                                .setDescription(`The Overseer has a task for you:\n\n*${questData.description}*`)
                                .addFields(
                                    { name: 'Objective', value: questData.objective },
                                    { name: 'Difficulty', value: questData.difficulty, inline: true },
                                    { name: 'Duration', value: `${duration} Minutes`, inline: true },
                                    { name: 'Rewards', value: `${caps} Caps, ${xp} XP` + (rewardItem ? `, 1x ${rewardItem}` : ''), inline: true }
                                )
                                .setColor('#3498db')
                                .setFooter({ text: questData.flavor || 'Good luck, wastelander.' });

                            interaction.editReply({ content: '✅ Quest Accepted!', embeds: [embed] });
                    });
                });
            });
        } 

        // --- COMPLETE ---
        else if (subcommand === 'complete') {
             db.get('SELECT * FROM active_quests WHERE user_id = ?', [userId], (err, quest) => {
                if (err || !quest) {
                    return interaction.reply({ content: '❌ You have no active quest.', ephemeral: true });
                }

                const endTime = quest.start_time + (quest.duration * 60 * 1000);
                if (Date.now() < endTime) {
                    return interaction.reply({ content: `⏳ Your quest is not done yet! Return <t:${Math.floor(endTime/1000)}:R>.`, ephemeral: true });
                }

                // Grant rewards
                db.serialize(() => {
                    db.run('UPDATE users SET balance = balance + ?, xp = xp + ? WHERE id = ?', [quest.reward_caps, quest.reward_xp, userId]);
                    if (quest.reward_item) {
                        db.run('INSERT INTO inventory (user_id, item_id, amount) VALUES (?, ?, 1) ON CONFLICT(user_id, item_id) DO UPDATE SET amount = amount + 1', [userId, quest.reward_item], (err) => {
                            // Ignore specific SQL errors if table constraints vary, but this is standard sqlite 3.24+ syntax usually
                             if (err) {
                                  // Fallback for older sqlite without upsert
                                  db.get('SELECT amount FROM inventory WHERE user_id = ? AND item_id = ?', [userId, quest.reward_item], (e, row) => {
                                      if (row) db.run('UPDATE inventory SET amount = amount + 1 WHERE user_id = ? AND item_id = ?', [userId, quest.reward_item]);
                                      else db.run('INSERT INTO inventory (user_id, item_id, amount) VALUES (?, ?, 1)', [userId, quest.reward_item]);
                                  });
                             }
                        });
                    }
                    db.run('DELETE FROM active_quests WHERE user_id = ?', [userId]);
                });

                const embed = new EmbedBuilder()
                    .setTitle('🎉 Quest Complete!')
                    .setDescription(`You successfully completed: **${quest.title}**\n\n**Rewards:**\n💰 ${quest.reward_caps} Caps\n✨ ${quest.reward_xp} XP` + (quest.reward_item ? `\n🎁 **Item:** ${quest.reward_item}` : ''))
                    .setColor('#f1c40f');

                interaction.reply({ embeds: [embed] });
            });
        }
    }
}).toJSON();
