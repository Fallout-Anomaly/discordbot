const db = require('../../utils/EconomyDB');
const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");

const SHOP_ITEMS = [
    { id: 'stimpak', name: 'Stimpak', price: 100, emoji: '💉', description: 'Restores 20 Health.', type: 'consumable' },
    { id: 'radaway', name: 'RadAway', price: 150, emoji: '💊', description: 'Removes 100 Rads.', type: 'consumable' },
    { id: 'purified_water', name: 'Purified Water', price: 50, emoji: '💧', description: 'Restores 10 Health.', type: 'consumable' },
    { id: 'nuka_cola', name: 'Nuka-Cola', price: 75, emoji: '🥤', description: 'Restores 15 Health, +5 Rads.', type: 'consumable' },
    { id: 'jet', name: 'Jet', price: 200, emoji: '💨', description: 'Temporarily boosts AP (Roleplay only).', type: 'consumable' },
    { id: '10mm_rounds', name: '10mm Rounds (x50)', price: 250, emoji: '🔫', description: 'Ammo for your pistol.', type: 'ammo' },
    { id: 'fusion_core', name: 'Fusion Core', price: 500, emoji: '🔋', description: 'Power for Power Armor.', type: 'ammo' },
    { id: 'lunchbox', name: 'Vault-Tec Lunchbox', price: 1000, emoji: '💼', description: 'Contains random loot.', type: 'lootbox' }
];

module.exports = new ApplicationCommand({
    command: {
        name: 'shop',
        description: 'Browse the wasteland marketplace.',
        options: [
            {
                name: 'view',
                description: 'View items available for sale.',
                type: ApplicationCommandOptionType.Subcommand
            },
            {
                name: 'buy',
                description: 'Buy an item from the shop.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: 'item',
                        description: 'The name or ID of the item to buy.',
                        type: ApplicationCommandOptionType.String,
                        required: true,
                        autocomplete: true
                    },
                    {
                        name: 'amount',
                        description: 'How many to buy (default 1).',
                        type: ApplicationCommandOptionType.Integer,
                        required: false,
                        minValue: 1
                    }
                ]
            }
        ]
    },
    run: async (client, interaction) => {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'view') {
            const embed = new EmbedBuilder()
                .setTitle('🛒 Wasteland General Store')
                .setColor('#2ecc71')
                .setThumbnail('https://i.imgur.com/7123123.png') // Generic cap icon or similar
                .setFooter({ text: 'Use /shop buy <item> to purchase.' });

            SHOP_ITEMS.forEach(item => {
                embed.addFields({
                    name: `${item.emoji} ${item.name} — ${item.price} Caps`,
                    value: `*${item.description}*`,
                    inline: false
                });
            });

            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'buy') {
            const query = interaction.options.getString('item');
            const amount = interaction.options.getInteger('amount') || 1;
            const userId = interaction.user.id;

            const item = SHOP_ITEMS.find(i => i.id === query || i.name === query);

            if (!item) {
                return interaction.reply({ content: '❌ Item not found. Check the /shop view list.', ephemeral: true });
            }

            const totalCost = item.price * amount;

            db.get('SELECT balance, stat_charisma FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) return interaction.reply({ content: '❌ Database error.', ephemeral: true });
                
                const balance = row ? row.balance : 0;
                const charisma = row ? (row.stat_charisma || 1) : 1;
                
                // Charisma Discount (1% per level, max 10%)
                const discount = Math.min(charisma * 0.01, 0.10);
                const finalCost = Math.floor(totalCost * (1 - discount));

                if (balance < finalCost) {
                    return interaction.reply({ content: `❌ You need **${finalCost} Caps** to buy this (Short by ${finalCost - balance}).`, ephemeral: true });
                }

                // Deduct balance and add item (Transaction)
                db.serialize(() => {
                    db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [finalCost, userId]);
                    
                    // Check if item exists in inventory
                    db.get('SELECT amount FROM inventory WHERE user_id = ? AND item_id = ?', [userId, item.id], (err, invRow) => {
                        if (invRow) {
                            db.run('UPDATE inventory SET amount = amount + ? WHERE user_id = ? AND item_id = ?', [amount, userId, item.id]);
                        } else {
                            db.run('INSERT INTO inventory (user_id, item_id, amount) VALUES (?, ?, ?)', [userId, item.id, amount]);
                        }
                    });
                });

                const discountMsg = discount > 0 ? ` (Discount applied: -${Math.floor(discount*100)}%)` : '';
                interaction.reply({ content: `🛍️ Purchase successful! You bought **${amount}x ${item.emoji} ${item.name}** for **${finalCost} Caps**${discountMsg}.` });
            });
        }
    },
    // Autocomplete handling for the 'item' option
    autocomplete: async (client, interaction) => {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const filtered = SHOP_ITEMS.filter(item => item.name.toLowerCase().includes(focusedValue) || item.id.includes(focusedValue));
        
        await interaction.respond(
            filtered.map(item => ({ name: `${item.emoji} ${item.name} (${item.price}c)`, value: item.id })).slice(0, 25)
        );
    }
}).toJSON();
