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

        db.all('SELECT item_id, amount FROM inventory WHERE user_id = ? AND amount > 0', [userId], (err, rows) => {
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

            // Map standard items to emojis (can share this list from a config file later if needed)
            const ITEM_EMOJIS = {
                'stimpak': '💉',
                'radaway': '💊',
                'purified_water': '💧',
                'nuka_cola': '🥤',
                'jet': '💨',
                '10mm_rounds': '🔫',
                'fusion_core': '🔋',
                'lunchbox': '💼'
            };

            const inventoryList = rows.map(row => {
                const emoji = ITEM_EMOJIS[row.item_id] || '📦';
                const name = row.item_id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                return `${emoji} **${name}**: x${row.amount}`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle(`🎒 Inventory - ${interaction.user.username}`)
                .setColor('#f1c40f')
                .setDescription(inventoryList)
                .setTimestamp();

            interaction.reply({ embeds: [embed] });
        });
    }
}).toJSON();
