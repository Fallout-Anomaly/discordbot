const db = require('../../utils/EconomyDB');
const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'use',
        description: 'Use a consumable item from your inventory.',
        options: [
            {
                name: 'item',
                description: 'The item ID or name to use.',
                type: ApplicationCommandOptionType.String,
                required: true,
                autocomplete: true
            }
        ]
    },
    autocomplete: async (client, interaction) => {
        const focusedValue = interaction.options.getFocused();
        const userId = interaction.user.id;
        
        // Getting inventory for autocomplete
        db.all(`SELECT i.name, i.id FROM inventory inv JOIN items i ON inv.item_id = i.id WHERE inv.user_id = ? AND (i.type = 'consumable' OR i.type = 'lootbox') AND inv.amount > 0 AND i.name LIKE ? LIMIT 25`, 
        [userId, `%${focusedValue}%`], (err, rows) => {
            if (err || !rows) return interaction.respond([]);
            // Filter unique by ID just in case, though DB group should handle it or DISTINCT
            const unique = [...new Map(rows.map(item => [item.id, item])).values()];
            interaction.respond(unique.map(row => ({ name: row.name, value: row.id })));
        });
    },
    run: async (client, interaction) => {
        // Handle AutoComplete logic is now in autocomplete() method above.

        const itemId = interaction.options.getString('item');
        const userId = interaction.user.id;

        // Verify item ownership and type (then consume atomically)
        db.get(`SELECT inv.amount, i.name, i.effect_full, i.type, i.emoji FROM inventory inv JOIN items i ON inv.item_id = i.id WHERE inv.user_id = ? AND inv.item_id = ?`, [userId, itemId], (err, item) => {
            if (err) return interaction.reply({ content: '❌ Database error.', ephemeral: true });
            
            if (!item || item.amount < 1) {
                return interaction.reply({ content: '❌ You do not have this item!', ephemeral: true });
            }

            if (item.type !== 'consumable' && item.type !== 'lootbox') {
                return interaction.reply({ content: `❌ You cannot "use" a ${item.type}. Equip it or sell it instead!`, ephemeral: true });
            }

            // Attempt to consume 1 item atomically
            db.run(
                'UPDATE inventory SET amount = amount - 1 WHERE user_id = ? AND item_id = ? AND amount > 0',
                [userId, itemId],
                function (updErr) {
                    if (updErr) return interaction.reply({ content: '❌ Database error.', ephemeral: true });
                    if (this.changes === 0) {
                        return interaction.reply({ content: "❌ You don't have this item!", ephemeral: true });
                    }

                    // Apply Effects only after successful consumption
                    let replyMessage = '';

                    if (item.type === 'consumable') {
                        const effects = item.effect_full.split(',');
                        let healthChange = 0;
                        let radChange = 0;

                        effects.forEach(eff => {
                            const match = eff.match(/([a-zA-Z_]+)([+-]\d+)/);
                            if (match) {
                                const type = match[1];
                                const val = parseInt(match[2]);
                                if (type === 'health') healthChange += val;
                                if (type === 'rads') radChange += val;
                            }
                        });

                        const xpGain = 10;
                        db.run('UPDATE users SET xp = xp + ? WHERE id = ?', [xpGain, userId]);

                        // Apply bounded health/rads changes
                        if (healthChange !== 0 || radChange !== 0) {
                            db.run(
                                'UPDATE users SET health = MIN(max_health, MAX(0, health + ?)), rads = MIN(1000, MAX(0, rads + ?)) WHERE id = ?',
                                [healthChange, radChange, userId]
                            );
                        }

                        replyMessage = `You used **${item.emoji} ${item.name}**.\n`;
                        if (healthChange > 0) replyMessage += `💚 **Healed ${healthChange} HP**\n`;
                        if (radChange < 0) replyMessage += `☢️ **Removed ${Math.abs(radChange)} Rads**\n`;
                        if (radChange > 0) replyMessage += `☢️ **Gained ${radChange} Rads**\n`;
                        replyMessage += `✨ +${xpGain} XP`;
                    } else if (item.type === 'lootbox') {
                        const capReward = Math.floor(Math.random() * 500) + 100;
                        db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [capReward, userId]);
                        replyMessage = `You opened **${item.name}** and found **${capReward} Caps**!`;
                    }

                    // Cleanup any zero/negative rows for this item
                    db.run('DELETE FROM inventory WHERE user_id = ? AND item_id = ? AND amount <= 0', [userId, itemId]);

                    const embed = new EmbedBuilder()
                        .setDescription(replyMessage)
                        .setColor('#2ecc71');

                    interaction.reply({ embeds: [embed] });
                }
            );
        });
    }
}).toJSON();
