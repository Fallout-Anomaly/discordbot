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

        // Verify item ownership and type
        db.get(`SELECT inv.amount, i.name, i.effect_full, i.type, i.emoji FROM inventory inv JOIN items i ON inv.item_id = i.id WHERE inv.user_id = ? AND inv.item_id = ?`, [userId, itemId], (err, item) => {
            if (err) return interaction.reply({ content: '❌ Database error.', ephemeral: true });
            
            if (!item || item.amount < 1) {
                return interaction.reply({ content: '❌ You do not have this item!', ephemeral: true });
            }

            if (item.type !== 'consumable' && item.type !== 'lootbox') {
                return interaction.reply({ content: `❌ You cannot "use" a ${item.type}. Equip it or sell it instead!`, ephemeral: true });
            }

            // Apply Effects
            let replyMessage = '';
            
            // Simple parsing of "health+20,rads-100"
            if (item.type === 'consumable') {
                const effects = item.effect_full.split(',');
                let healthChange = 0;
                let radChange = 0;
                
                effects.forEach(eff => {
                    const match = eff.match(/([a-zA-Z_]+)([+\-]\d+)/);
                    if (match) {
                        const type = match[1];
                        const val = parseInt(match[2]);
                        
                        if (type === 'health') healthChange += val;
                        if (type === 'rads') radChange += val;
                        // Add more like xp, etc if needed
                    }
                });
                
                // Grant XP for using items (Survive mechanic)
                const xpGain = 10;
                db.run('UPDATE users SET xp = xp + ? WHERE id = ?', [xpGain, userId]);

                replyMessage = `You used **${item.emoji} ${item.name}**.\n`;
                if (healthChange > 0) replyMessage += `💚 **Healed ${healthChange} HP**\n`;
                if (radChange < 0) replyMessage += `☢️ **Removed ${Math.abs(radChange)} Rads**\n`;
                if (radChange > 0) replyMessage += `☢️ **Gained ${radChange} Rads**\n`;
                replyMessage += `✨ +${xpGain} XP`;

            } else if (item.type === 'lootbox') {
                // Open lootbox logic
                 // Random reward from items table?
                 // For now simple caps reward
                 const capReward = Math.floor(Math.random() * 500) + 100;
                 db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [capReward, userId]);
                 replyMessage = `You opened **${item.name}** and found **${capReward} Caps**!`;
            }

            // Consume Item
            db.serialize(() => {
                if (item.amount > 1) {
                    db.run('UPDATE inventory SET amount = amount - 1 WHERE user_id = ? AND item_id = ?', [userId, itemId]);
                } else {
                    db.run('DELETE FROM inventory WHERE user_id = ? AND item_id = ?', [userId, itemId]);
                }
            });

            const embed = new EmbedBuilder()
                .setDescription(replyMessage)
                .setColor('#2ecc71');

            interaction.reply({ embeds: [embed] });
        });
    }
}).toJSON();
