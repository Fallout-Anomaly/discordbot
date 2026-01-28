const { EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const db = require('../../utils/EconomyDB');
const { checkLevelUp, calculateLevel } = require('../../utils/LevelSystem');

const HUNT_ENCOUNTERS = [
    { name: 'Radroach', caps: 15, xp: 8, chance: 30, emoji: '🪳', difficulty: 'Easy', danger: 5 },
    { name: 'Bloatfly', caps: 30, xp: 15, chance: 25, emoji: '🪰', difficulty: 'Easy', danger: 10 },
    { name: 'Mole Rat', caps: 50, xp: 25, chance: 20, emoji: '🐀', difficulty: 'Medium', danger: 15 },
    { name: 'Radscorpion', caps: 100, xp: 40, chance: 12, emoji: '🦂', difficulty: 'Hard', danger: 25 },
    { name: 'Feral Ghoul', caps: 150, xp: 60, chance: 8, emoji: '🧟', difficulty: 'Hard', danger: 30 },
    { name: 'Deathclaw', caps: 500, xp: 200, chance: 3, emoji: '🦖', difficulty: 'Legendary', danger: 50 },
    { name: 'Mirelurk Queen', caps: 400, xp: 150, chance: 2, emoji: '🦀', difficulty: 'Epic', danger: 45 }
];

const FAILURE_MESSAGES = [
    'You got ambushed! Lost some caps fleeing...',
    'A Radscorpion got the jump on you!',
    'You tripped over a skeleton. Clumsy wastelander.',
    'A pack of Mole Rats scared you off!',
    'You ran out of ammo and had to retreat!',
    'Better luck next hunt, survivor.'
];

module.exports = new ApplicationCommand({
    command: {
        name: 'hunt',
        description: 'Hunt dangerous creatures in the wasteland',
    },
    run: async (client, interaction) => {
        const userId = interaction.user.id;
        const now = Date.now();
        const HUNT_COOLDOWN = 10 * 60 * 1000; // 10 minutes

        // Defer reply to allow time for DB queries
        await interaction.deferReply({ flags: 64 });

        // Check cooldown
        const hasCooldown = await new Promise((resolve) => {
            db.get('SELECT cooldown_expiry FROM hunt_cooldown WHERE user_id = ?', [userId], (err, row) => {
                if (row && now < row.cooldown_expiry) {
                    const remaining = row.cooldown_expiry - now;
                    const minutes = Math.ceil(remaining / 60000);
                    interaction.editReply({ 
                        content: `⏳ You need to rest after that hunt. Return in **${minutes} minute${minutes > 1 ? 's' : ''}**.` 
                    });
                    return resolve(true);
                }
                resolve(false);
            });
        });

        if (hasCooldown) return;

        // Get user stats
        const userData = await new Promise((resolve) => {
            db.get('SELECT balance, xp, stat_perception, stat_agility, stat_luck FROM users WHERE id = ?', [userId], (err, row) => {
                resolve(row || { balance: 0, xp: 0, stat_perception: 1, stat_agility: 1, stat_luck: 1 });
            });
        });

        const perception = userData.stat_perception || 1;
        const agility = userData.stat_agility || 1;
        const luck = userData.stat_luck || 1;
        const successBonus = (perception + agility + luck) / 3;

        const roll = Math.random() * 100;
        let cumulativeChance = 0;
        let encounter = null;

        for (const creature of HUNT_ENCOUNTERS) {
            cumulativeChance += creature.chance;
            if (roll <= cumulativeChance) {
                encounter = creature;
                break;
            }
        }

        if (!encounter) {
            const failMsg = FAILURE_MESSAGES[Math.floor(Math.random() * FAILURE_MESSAGES.length)];
            const lostCaps = Math.floor(Math.random() * 30) + 10;
            
            await new Promise((resolve) => {
                db.run('UPDATE users SET balance = MAX(0, balance - ?) WHERE id = ?', [lostCaps, userId], () => resolve());
            });

            const cooldownEnd = now + HUNT_COOLDOWN;
            await new Promise((resolve) => {
                db.run('INSERT OR REPLACE INTO hunt_cooldown (user_id, cooldown_expiry) VALUES (?, ?)', [userId, cooldownEnd], () => resolve());
            });

            const embed = new EmbedBuilder()
                .setTitle('💥 Hunt Failed')
                .setDescription(failMsg)
                .addFields({ name: '💸 Caps Lost', value: `-${lostCaps}`, inline: true })
                .setColor('#E74C3C')
                .setFooter({ text: 'The wasteland is unforgiving...' });

            return interaction.editReply({ embeds: [embed] });
        }

        const successChance = Math.max(20, 100 - encounter.danger + (successBonus * 5));
        const huntRoll = Math.random() * 100;

        if (huntRoll > successChance) {
            const radiationGain = Math.floor(encounter.danger / 2);
            const lostCaps = Math.floor(encounter.caps * 0.3);

            await new Promise((resolve) => {
                db.run(
                    'UPDATE users SET radiation = MIN(100, radiation + ?), balance = MAX(0, balance - ?) WHERE id = ?',
                    [radiationGain, lostCaps, userId],
                    () => resolve()
                );
            });

            const cooldownEnd = now + HUNT_COOLDOWN;
            await new Promise((resolve) => {
                db.run('INSERT OR REPLACE INTO hunt_cooldown (user_id, cooldown_expiry) VALUES (?, ?)', [userId, cooldownEnd], () => resolve());
            });

            const embed = new EmbedBuilder()
                .setTitle(`${encounter.emoji} Hunt Failed - ${encounter.name}`)
                .setDescription(`You encountered a **${encounter.name}** but it got away!\n\nYou took ${radiationGain}% radiation damage and lost some caps.`)
                .addFields(
                    { name: 'Difficulty', value: encounter.difficulty, inline: true },
                    { name: '☢️ Radiation Gained', value: `+${radiationGain}%`, inline: true },
                    { name: '💸 Caps Lost', value: `-${lostCaps}`, inline: true },
                    { name: 'Success Chance Was', value: `${successChance.toFixed(1)}%`, inline: false }
                )
                .setColor('#E67E22')
                .setFooter({ text: 'Use RadAway to heal radiation!' })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        await new Promise((resolve) => {
            db.run(
                'UPDATE users SET balance = balance + ?, xp = xp + ? WHERE id = ?',
                [encounter.caps, encounter.xp, userId],
                () => resolve()
            );
        });

        const cooldownEnd = now + HUNT_COOLDOWN;
        await new Promise((resolve) => {
            db.run('INSERT OR REPLACE INTO hunt_cooldown (user_id, cooldown_expiry) VALUES (?, ?)', [userId, cooldownEnd], () => resolve());
        });

        const newBalance = userData.balance + encounter.caps;
        const newXp = userData.xp + encounter.xp;
        const levelCheck = checkLevelUp(userData.xp, newXp);

        const embed = new EmbedBuilder()
            .setTitle(`${encounter.emoji} Successful Hunt!`)
            .setDescription(`You successfully hunted a **${encounter.name}**!`)
            .addFields(
                { name: 'Difficulty', value: encounter.difficulty, inline: true },
                { name: '💰 Caps Earned', value: `+${encounter.caps}`, inline: true },
                { name: '✨ XP Gained', value: `+${encounter.xp}`, inline: true },
                { name: 'Success Chance', value: `${successChance.toFixed(1)}%`, inline: true },
                { name: 'New Balance', value: `${newBalance} Caps`, inline: true }
            );

        // Add level up announcement if applicable
        if (levelCheck.leveledUp) {
            embed.addFields({ name: '⭐ LEVEL UP!', value: `**Level ${levelCheck.newLevel}** 🎉`, inline: false });
            embed.setColor('#FFD700');
        }
            )
            .setColor(encounter.difficulty === 'Legendary' ? '#FFD700' : encounter.difficulty === 'Epic' ? '#9B59B6' : encounter.difficulty === 'Hard' ? '#E74C3C' : '#2ECC71')
            .setFooter({ text: 'Higher Perception, Agility, and Luck improve hunt success!' })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    }
}).toJSON();
