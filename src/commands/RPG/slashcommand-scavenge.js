const db = require('../../utils/EconomyDB');
const { EmbedBuilder } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");
const config = require('../../config');
const { SCAVENGE_DEFAULTS } = require('../../utils/Constants');
const { error } = require('../../utils/Console');
const { checkLevelUp } = require('../../utils/LevelSystem');

module.exports = new ApplicationCommand({
    command: {
        name: 'scavenge',
        description: 'Send your character out to find loot (Caps, Item, XP).',
    },
    run: async (client, interaction) => {
        const userId = interaction.user.id;
        const now = Date.now();

        // Defer reply for database operations
        await interaction.deferReply({ flags: 64 });

        // 1. Check if already scavenging
        const activeScavenge = await new Promise((resolve, reject) => {
            db.get('SELECT start_time, duration FROM scavenge WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        }).catch(err => {
            error('[SCAVENGE] DB Error checking active:', err);
            return null;
        });

        if (activeScavenge) {
            const endTime = activeScavenge.start_time + activeScavenge.duration;
            if (now < endTime) {
                const remaining = endTime - now;
                const minutes = Math.ceil(remaining / 60000);
                return interaction.editReply({ content: `⏳ You are currently scavenging! Return in **${minutes} minutes**.` });
            } else {
                // Attempt atomic completion: delete only if end time passed
                const deleted = await new Promise((resolve) => {
                    db.run(
                        'DELETE FROM scavenge WHERE user_id = ? AND ? >= (start_time + duration)',
                        [userId, now],
                        function (err) {
                            if (err) resolve(false);
                            else resolve(this.changes > 0);
                        }
                    );
                });

                if (!deleted) {
                    return interaction.editReply({ content: `⏳ Scavenging not finished or already claimed.` });
                }
                return processScavengeResult(client, interaction);
            }
        }

        // 2. START NEW SCAVENGE
        const user = await new Promise((resolve) => {
            db.get('SELECT daily_scavenge_count, last_scavenge_reset FROM users WHERE id = ?', [userId], (err, row) => {
                resolve(row || { daily_scavenge_count: 0, last_scavenge_reset: 0 });
            });
        });

        let count = user.daily_scavenge_count || 0;
        const lastReset = user.last_scavenge_reset || 0;
        
        // Reset if 24h passed
        if (now - lastReset > 24 * 60 * 60 * 1000) {
            count = 0;
            db.run('UPDATE users SET daily_scavenge_count = 0, last_scavenge_reset = ? WHERE id = ?', [now, userId]);
        }

        // Patron Benefits
        let dailyLimit = SCAVENGE_DEFAULTS.LIMIT_NORMAL;
        let scavengeDuration = SCAVENGE_DEFAULTS.DURATION_NORMAL;
        let statusMsg = '';

        const donatorRole = config.users?.donator_role;
        const boosterRole = config.users?.booster_role;

        if (donatorRole && interaction.member.roles.cache.has(donatorRole)) {
            dailyLimit = SCAVENGE_DEFAULTS.LIMIT_DONATOR;
            scavengeDuration = SCAVENGE_DEFAULTS.DURATION_DONATOR;
            statusMsg = '🌟 **Donator Perks Active!** (Limit: 20 | Speed: Fast)\n';
        } else if (boosterRole && interaction.member.roles.cache.has(boosterRole)) {
            dailyLimit = SCAVENGE_DEFAULTS.LIMIT_BOOSTER;
            scavengeDuration = SCAVENGE_DEFAULTS.DURATION_BOOSTER;
            statusMsg = '🚀 **Booster Perks Active!** (Limit: 15 | Speed: Medium)\n';
        }

        if (count >= dailyLimit) {
            return interaction.editReply({ content: `🛑 **Daily Limit Reached**\nYou are too exhausted to scavenge more today. (Limit: ${dailyLimit}/day)` });
        }

        const durationMs = scavengeDuration * 60 * 1000;
        
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('INSERT OR IGNORE INTO scavenge (user_id, start_time, duration) VALUES (?, ?, ?)', [userId, now, durationMs]);
                db.run('UPDATE users SET daily_scavenge_count = daily_scavenge_count + 1 WHERE id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }).catch(err => {
            error('[SCAVENGE] DB Error starting:', err);
            return interaction.editReply({ content: '❌ Database error starting scavenge.' });
        });

        interaction.editReply({ content: `🎒 You head out into the wasteland... (Attempt ${count + 1}/${dailyLimit})\n${statusMsg}Check back in **${scavengeDuration} minutes** to see what you found.` });
    }
}).toJSON();

async function processScavengeResult(client, interaction) {
    const userId = interaction.user.id;
    
    const user = await new Promise((resolve) => {
        db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
            resolve(row);
        });
    });

    if (!user) return interaction.editReply({ content: 'Error loading user data.' });

    const luck = user.stat_luck || 1;
    const perception = user.stat_perception || 1;
    const intelligence = user.stat_intelligence || 1;

    // Rewards
    const capsBase = Math.floor(Math.random() * 50) + 10;
    const caps = Math.floor(capsBase * (1 + (luck * 0.1)));

    const xpBase = Math.floor(Math.random() * 20) + 10;
    const xp = Math.floor(xpBase * (1 + (intelligence * 0.1)));

    let itemMsg = '';
    if (Math.random() < (0.1 + (perception * 0.05))) {
        itemMsg = '\n📦 You found a **Stimpak**! (Added to inventory)';
        db.run("INSERT INTO inventory (user_id, item_id, amount) VALUES (?, 'stimpak', 1) ON CONFLICT(user_id, item_id) DO UPDATE SET amount = amount + 1", [userId]);
    }

    let damageMsg = '';
    if (Math.random() < 0.1) {
        const dmg = 10;
        const rads = 5;
        damageMsg = `\n⚠️ You stepped on a mine! Taken **${dmg} DMG** and **${rads} Rads**.`;
        db.run(`UPDATE users SET health = MAX(0, MIN(max_health, health - ?)), radiation = MAX(0, MIN(100, radiation + ?)) WHERE id = ?`, [dmg, rads, userId]);
    }

    // Check for level up
    const oldXp = user.xp || 0;
    const newXp = oldXp + xp;
    const levelCheck = checkLevelUp(oldXp, newXp);

    await new Promise((resolve) => {
        db.run('UPDATE users SET balance = IFNULL(balance, 0) + ?, xp = IFNULL(xp, 0) + ?, stat_points = IFNULL(stat_points, 0) + ? WHERE id = ?', [caps, xp, levelCheck.levelsGained, userId], () => resolve());
    });

    const embed = new EmbedBuilder()
        .setTitle('🎒 Scavenge Report')
        .setColor('#f39c12')
        .setDescription(`You returned from the wasteland!`)
        .addFields(
            { name: 'Caps', value: `+${caps}`, inline: true },
            { name: 'XP', value: `+${xp}`, inline: true },
            { name: 'Loot', value: itemMsg || 'None', inline: true },
            { name: 'Status', value: damageMsg || 'Safe return', inline: false }
        );

    // Add level up announcement if applicable
    if (levelCheck.leveledUp) {
        embed.addFields({ name: '⭐ LEVEL UP!', value: `**Level ${levelCheck.newLevel}** 🎉\n+${levelCheck.levelsGained} SPECIAL Point${levelCheck.levelsGained > 1 ? 's' : ''} earned!`, inline: false });
        embed.setColor('#FFD700');
    }

    interaction.editReply({ embeds: [embed] });
}
