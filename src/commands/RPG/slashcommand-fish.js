const { EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const db = require('../../utils/EconomyDB');
const { checkLevelUp } = require('../../utils/LevelSystem');

const FISH_TYPES = [
    { name: 'Radiated Catfish', caps: 25, xp: 10, chance: 35, emoji: '🐟', rarity: 'Common' },
    { name: 'Glowing Salmon', caps: 50, xp: 20, chance: 25, emoji: '🐠', rarity: 'Uncommon' },
    { name: 'Mutant Bass', caps: 75, xp: 30, chance: 20, emoji: '🎣', rarity: 'Rare' },
    { name: 'Two-Headed Trout', caps: 125, xp: 50, chance: 12, emoji: '🐡', rarity: 'Epic' },
    { name: 'Deathclaw Egg (in water?!)', caps: 300, xp: 100, chance: 5, emoji: '🥚', rarity: 'Legendary' },
    { name: 'Old Boot', caps: 5, xp: 5, chance: 3, emoji: '👢', rarity: 'Junk' }
];

const FAILURE_MESSAGES = [
    'The fish got away! 🎣',
    'Your line snapped! Maybe it was a Deathclaw...',
    'A Radroach ate your bait! 🪳',
    'You caught nothing but disappointment.',
    'The fish laughed at you. Actually laughed.',
    'A Mirelurk stole your catch! 🦀'
];

module.exports = new ApplicationCommand({
    command: {
        name: 'fish',
        description: 'Fish in the irradiated waters of the wasteland',
    },
    run: async (client, interaction) => {
        const userId = interaction.user.id;
        const now = Date.now();
        const FISH_COOLDOWN = 5 * 60 * 1000; // 5 minutes

        // Check cooldown
        const hasCooldown = await new Promise((resolve) => {
            db.get('SELECT cooldown_expiry FROM fish_cooldown WHERE user_id = ?', [userId], (err, row) => {
                if (row && now < row.cooldown_expiry) {
                    const remaining = row.cooldown_expiry - now;
                    const minutes = Math.ceil(remaining / 60000);
                    interaction.reply({ 
                        content: `⏳ Your fishing line is still in the water. Return in **${minutes} minute${minutes > 1 ? 's' : ''}**.`, 
                        flags: 64 
                    });
                    return resolve(true); // Cooldown active
                }
                resolve(false); // No cooldown
            });
        });

        if (hasCooldown) return;

        // Proceed with fishing
        executeFish(client, interaction, userId, FISH_COOLDOWN);
    }
}).toJSON();

async function executeFish(client, interaction, userId, FISH_COOLDOWN) {

        // Roll for catch
        const roll = Math.random() * 100;
        let cumulativeChance = 0;
        let caught = null;

        for (const fish of FISH_TYPES) {
            cumulativeChance += fish.chance;
            if (roll <= cumulativeChance) {
                caught = fish;
                break;
            }
        }

        if (!caught) {
            // Failed to catch anything
            const failMsg = FAILURE_MESSAGES[Math.floor(Math.random() * FAILURE_MESSAGES.length)];
            
            // Set cooldown
            const cooldownEnd = Date.now() + FISH_COOLDOWN;
            await new Promise((resolve) => {
                db.run('INSERT OR REPLACE INTO fish_cooldown (user_id, cooldown_expiry) VALUES (?, ?)', [userId, cooldownEnd], () => resolve());
            });
            
            const embed = new EmbedBuilder()
                .setTitle('🎣 Fishing Failed')
                .setDescription(failMsg)
                .setColor('#95a5a6')
                .setFooter({ text: 'Better luck next time, wastelander!' });

            return interaction.reply({ embeds: [embed] });
        }

        // Success! Give rewards
        const userData = await new Promise((resolve) => {
            db.get('SELECT xp FROM users WHERE id = ?', [userId], (err, row) => resolve(row || { xp: 0 }));
        });

        const oldXp = userData.xp || 0;
        const newXp = oldXp + caught.xp;
        const levelCheck = checkLevelUp(oldXp, newXp);
        
        await new Promise((resolve) => {
            db.run(
                'UPDATE users SET balance = balance + ?, xp = xp + ?, stat_points = stat_points + ? WHERE id = ?',
                [caught.caps, caught.xp, levelCheck.levelsGained, userId],
                () => resolve()
            );
        });

        // Set cooldown
        const cooldownEnd = Date.now() + FISH_COOLDOWN;
        await new Promise((resolve) => {
            db.run('INSERT OR REPLACE INTO fish_cooldown (user_id, cooldown_expiry) VALUES (?, ?)', [userId, cooldownEnd], () => resolve());
        });

        // Get new balance
        const userData2 = await new Promise((resolve) => {
            db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, row) => {
                resolve(row || { balance: caught.caps });
            });
        });

        const embed = new EmbedBuilder()
            .setTitle(`${caught.emoji} Fishing Success!`)
            .setDescription(`You caught a **${caught.name}**!`)
            .addFields(
                { name: 'Rarity', value: caught.rarity, inline: true },
                { name: '💰 Caps Earned', value: `+${caught.caps}`, inline: true },
                { name: '✨ XP Gained', value: `+${caught.xp}`, inline: true },
                { name: 'New Balance', value: `${userData2.balance} Caps`, inline: false }
            );

        // Add level up announcement if applicable
        if (levelCheck.leveledUp) {
            embed.addFields({ name: '⭐ LEVEL UP!', value: `**Level ${levelCheck.newLevel}** 🎉\n+1 SPECIAL Point earned!`, inline: false });
            embed.setColor('#FFD700');
        } else {
            embed.setColor(caught.rarity === 'Legendary' ? '#FFD700' : caught.rarity === 'Epic' ? '#9B59B6' : caught.rarity === 'Rare' ? '#3498DB' : '#2ECC71');
        }
        
        embed.setFooter({ text: 'The waters of the wasteland are full of surprises!' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
