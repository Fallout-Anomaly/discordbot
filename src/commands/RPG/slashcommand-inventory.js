const db = require('../../utils/EconomyDB');
const { EmbedBuilder } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'inventory',
        description: 'View your inventory items.',
        aliases: ['inv', 'bag']
    },
    run: async (client, interaction) => {
        const userId = interaction.user.id;
        
        // Join with items table to get proper names and emojis
        const query = `
            SELECT i.name, i.emoji, i.type, i.rarity, inv.amount, inv.item_id 
            FROM inventory inv
            LEFT JOIN items i ON inv.item_id = i.id
            WHERE inv.user_id = ? AND inv.amount > 0
            ORDER BY i.type, i.name
        `;

        db.all(query, [userId], (err, rows) => {
            if (err) {
                console.error(err);
                return interaction.reply({ content: '❌ Database error.', ephemeral: true });
            }

            if (!rows || rows.length === 0) {
                return interaction.reply({ 
                    embeds: [new EmbedBuilder().setDescription('🎒 **Your inventory is empty.**\nVisit the `/shop view` to buy supplies!')
                    .setColor('#e74c3c')] 
                });
            }

            let invString = '';
            
            // Group by type? Or just list them.
            // Let's just list them nicely for now.
            rows.forEach(row => {
                 // Fallback if item deleted from DB but still in inventory? (Should shouldn't happen usually)
                 const name = row.name || row.item_id;
                 const emoji = row.emoji || '📦';
                 const rarityIcon = row.rarity === 'legendary' ? '⭐' : '';
                 
                 invString += `${emoji} **${name}** ${rarityIcon} — x${row.amount}\n`;
            });

            const embed = new EmbedBuilder()
                .setTitle(`🎒 Inventory - ${interaction.user.username}`)
                .setColor('#f1c40f')
                .setDescription(invString.substring(0, 4000) || "Empty.")
                .setTimestamp();

            interaction.reply({ embeds: [embed] });
        });
    }
}).toJSON();
