const { EmbedBuilder } = require('discord.js');
const Component = require('../../structure/Component');
const FactionManager = require('../../utils/FactionManager');
const { checkLevelUp } = require('../../utils/LevelSystem');
const { FACTION_QUESTS } = require('../../utils/FactionQuestData');

// Get the corresponding encounter scenario index (we use the same random one throughout)
function getEncounterDifficulty(choice) {
    const difficulties = {
        attack: 0.4,    // 40% success (60% fail)
        sneak: 0.3,     // 70% success (30% fail)
        talk: 0.2       // 90% success (10% fail)
    };
    return difficulties[choice] || 0.5;
}

function getRewardMultiplier(choice) {
    const multipliers = {
        attack: 2.0,    // Double rewards
        sneak: 1.0,     // Normal rewards
        talk: 0.5       // Half rewards
    };
    return multipliers[choice] || 1.0;
}

module.exports = new Component({
    customId: /^quest_(attack|sneak|talk)_\d+_.+$/,
    type: 'button',
    options: {
        public: false
    },
    run: async (client, interaction) => {
        try {
            // 1. Lock the button immediately to prevent double-clicks (shows spinner)
            await interaction.deferUpdate();

            // Parse button ID: quest_[choice]_[userId]_[questId]
            const parts = interaction.customId.split('_');
            const choice = parts[1]; // attack, sneak, or talk
            const buttonUserId = parts[2];
            const questId = parts.slice(3).join('_'); // rejoin in case questId has underscores

            // Verify the user clicking is the one who started the quest
            if (interaction.user.id !== buttonUserId) {
                return interaction.followUp({
                    content: '❌ This is not your quest!',
                    ephemeral: true
                });
            }

            const db = require('../../utils/EconomyDB');

            // Get quest data from database
            const activeQuest = await new Promise((resolve) => {
                db.get(
                    'SELECT * FROM active_quests WHERE user_id = ? AND quest_id = ?',
                    [interaction.user.id, questId],
                    (err, row) => resolve(row)
                );
            });

            if (!activeQuest) {
                return interaction.editReply({
                    content: '❌ Quest data not found. Quest may have expired.',
                    embeds: [],
                    components: []
                });
            }

            // Get quest definition from FACTION_QUESTS
            const quests = FACTION_QUESTS[activeQuest.faction_id] || [];
            const quest = quests.find(q => q.id === activeQuest.quest_id);

            if (!quest) {
                return interaction.editReply({
                    content: '❌ Quest definition not found.',
                    embeds: [],
                    components: []
                });
            }

            // Calculate success based on choice
            const difficulty = getEncounterDifficulty(choice);
            const roll = Math.random();
            const success = roll > difficulty; // Higher roll = success
            const multiplier = getRewardMultiplier(choice);

            // Calculate actual rewards
            const capsReward = Math.floor(quest.reward.caps * multiplier);
            const repReward = Math.floor(quest.reward.rep * multiplier);
            const xpReward = Math.floor(quest.reward.xp * multiplier);

            if (!success) {
                // FAILURE
                const failMessages = [
                    "You were overwhelmed and had to retreat!",
                    "Your plan didn't work as expected.",
                    "The situation spiraled out of control.",
                    "Luck was not on your side today.",
                    "You barely escaped with your life!"
                ];

                const embed = new EmbedBuilder()
                    .setTitle('❌ Quest Failed')
                    .setDescription(failMessages[Math.floor(Math.random() * failMessages.length)])
                    .setColor(0xFF0000);

                // Delete quest from database
                await new Promise((resolve) => {
                    db.run('DELETE FROM active_quests WHERE user_id = ?', [interaction.user.id], () => resolve());
                });

                return interaction.editReply({
                    embeds: [embed],
                    components: []
                });
            }

            // SUCCESS - Award rewards
            const repResult = await FactionManager.modifyReputation(interaction.user.id, activeQuest.faction_id, repReward, 'quest');

            // Award caps and XP
            await new Promise((resolve) => {
                db.run(
                    'UPDATE users SET caps = caps + ?, xp = xp + ? WHERE id = ?',
                    [capsReward, xpReward, interaction.user.id],
                    () => resolve()
                );
            });

            // Check for level up
            const user = await new Promise((resolve) => {
                db.get('SELECT xp FROM users WHERE id = ?', [interaction.user.id], (err, row) => resolve(row));
            });

            const levelCheck = await checkLevelUp(interaction.user.id, user.xp - xpReward, user.xp);

            // Delete completed quest
            await new Promise((resolve) => {
                db.run('DELETE FROM active_quests WHERE user_id = ?', [interaction.user.id], () => resolve());
            });

            // Build success embed
            const successMessages = [
                "You emerged victorious!",
                "Success! Your strategy worked perfectly.",
                "Against the odds, you prevailed!",
                "Excellent work out there!",
                "You completed the objective flawlessly."
            ];

            const embed = new EmbedBuilder()
                .setTitle(`✅ Quest Complete: ${quest.name}`)
                .setDescription(successMessages[Math.floor(Math.random() * successMessages.length)])
                .setColor(0x1F8B4C)
                .addFields(
                    { name: 'Caps', value: `+${capsReward}`, inline: true },
                    { name: 'Reputation', value: `+${repReward} → **${repResult.rank}**`, inline: true },
                    { name: 'Experience', value: `+${xpReward}`, inline: true }
                );

            if (levelCheck.leveledUp) {
                embed.addFields({
                    name: '⭐ LEVEL UP!',
                    value: `**Level ${levelCheck.newLevel}** 🎉\n+${levelCheck.levelsGained} SPECIAL Point${levelCheck.levelsGained > 1 ? 's' : ''}!`,
                    inline: false
                });
            }

            await interaction.editReply({
                embeds: [embed],
                components: []
            });

        } catch (error) {
            console.error('Quest encounter button error:', error);
            await interaction.editReply({
                content: '❌ Error processing quest encounter.',
                embeds: [],
                components: []
            }).catch(() => {});
        }
    }
});
