const db = require('../../utils/EconomyDB');
const { EmbedBuilder } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");
const config = require('../../config');

module.exports = new ApplicationCommand({
    command: {
        name: 'scavenge',
        description: 'Send your character out to find loot (Caps, Item, XP).',
    },
    run: async (client, interaction) => {
        const userId = interaction.user.id;

        // Check if already scavenging
        db.get('SELECT start_time, duration FROM scavenge WHERE user_id = ?', [userId], (err, row) => {
            const now = Date.now();
            
            if (row) {
                const endTime = row.start_time + row.duration;
                if (now < endTime) {
                    const remaining = endTime - now;
                    const minutes = Math.ceil(remaining / 60000);
                    return interaction.reply({ content: `⏳ You are currently scavenging! Return in **${minutes} minutes**.`, ephemeral: true });
                } else {
                    // Scavenge complete, calculate rewards
                    db.run('DELETE FROM scavenge WHERE user_id = ?', [userId]); // clear timer
                    return processScavengeResult(client, interaction);
                }
            } else {
                // START NEW SCAVENGE
                // Check daily limit
                db.get('SELECT daily_scavenge_count, last_scavenge_reset FROM users WHERE id = ?', [userId], (err, user) => {
                    let count = user ? (user.daily_scavenge_count || 0) : 0;
                    const lastReset = user ? (user.last_scavenge_reset || 0) : 0;
                    
                    // Reset if 24h passed
                    if (now - lastReset > 24 * 60 * 60 * 1000) {
                        count = 0;
                        db.run('UPDATE users SET daily_scavenge_count = 0, last_scavenge_reset = ? WHERE id = ?', [now, userId]);
                    }

                    // Patron Benefits
                    let dailyLimit = 10;
                    let scavengeDuration = 15; // Minutes
                    let statusMsg = '';

                    const donatorRole = config.users.donator_role;
                    const boosterRole = config.users.booster_role;

                    if (interaction.member.roles.cache.has(donatorRole)) {
                        dailyLimit = 20; // Legendary Tier
                        scavengeDuration = 5; // Ultra Fast
                        statusMsg = '🌟 **Donator Perks Active!** (Limit: 20 | Speed: Fast)\n';
                    } else if (interaction.member.roles.cache.has(boosterRole)) {
                        dailyLimit = 15; // Booster Tier
                        scavengeDuration = 10; // Fast
                        statusMsg = '🚀 **Booster Perks Active!** (Limit: 15 | Speed: Medium)\n';
                    }

                    if (count >= dailyLimit) {
                         const limitMsg = `(Limit: ${dailyLimit}/day)`;
                        return interaction.reply({ content: `🛑 **Daily Limit Reached**\nYou are too exhausted to scavenge more today. ${limitMsg}`, ephemeral: true });
                    }

                    const durationMs = scavengeDuration * 60 * 1000;
                    db.run('INSERT OR REPLACE INTO scavenge (user_id, start_time, duration) VALUES (?, ?, ?)', [userId, now, durationMs]);
                    
                    // Increment count
                    db.run('UPDATE users SET daily_scavenge_count = daily_scavenge_count + 1 WHERE id = ?', [userId]);

                    interaction.reply({ content: `🎒 You head out into the wasteland... (Attempt ${count + 1}/${dailyLimit})\n${statusMsg}Check back in **${scavengeDuration} minutes** to see what you found.` });
                });
            }
        });
    }
}).toJSON();

function processScavengeResult(client, interaction) {
    const userId = interaction.user.id;
    
    // Fetch stats to influence result
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (!user) return interaction.reply({ content: 'Error loading user data.' });

        const luck = user.stat_luck || 1;
        const perception = user.stat_perception || 1;
        const intelligence = user.stat_intelligence || 1;

        // Rewards
        const capsBase = Math.floor(Math.random() * 50) + 10;
        const caps = Math.floor(capsBase * (1 + (luck * 0.1))); // Luck bonus

        const xpBase = Math.floor(Math.random() * 20) + 10;
        const xp = Math.floor(xpBase * (1 + (intelligence * 0.1))); // Int bonus

        // Items (Placeholder logic until inventory is fully built)
        let itemMsg = '';
        if (Math.random() < (0.1 + (perception * 0.05))) { // Perception increases item chance
            itemMsg = '\n📦 You found a **Stimpak**! (Added to inventory)';
            db.run("INSERT INTO inventory (user_id, item_id, amount) VALUES (?, 'stimpak', 1)", [userId]);
        }

        // Risks
        let damageMsg = '';
        const roll = Math.random();
        if (roll < 0.1) {
            const dmg = 10;
            const rads = 5;
            user.health -= dmg;
            user.rads += rads;
            damageMsg = `\n⚠️ You stepped on a mine! Taken **${dmg} DMG** and **${rads} Rads**.`;
            
            db.run(`UPDATE users SET health = ?, rads = ? WHERE id = ?`, [user.health, user.rads, userId]);
        }

        db.run('UPDATE users SET balance = balance + ?, xp = xp + ? WHERE id = ?', [caps, xp, userId]);

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

        interaction.reply({ embeds: [embed] });
    });
}
