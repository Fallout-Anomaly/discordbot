const db = require('../../utils/EconomyDB');
const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");
const config = require('../../config');

module.exports = new ApplicationCommand({
    command: {
        name: 'shop',
        description: 'Browse the wasteland marketplace.',
        options: [
            {
                name: 'view',
                description: 'View items available for sale.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: 'type',
                        description: 'Filter by item type.',
                        type: ApplicationCommandOptionType.String,
                        required: false,
                        choices: [
                            { name: 'Consumables', value: 'consumable' },
                            { name: 'Weapons', value: 'weapon' },
                            { name: 'Armor', value: 'armor' },
                            { name: 'Ammo', value: 'ammo' },
                            { name: 'Junk', value: 'junk' },
                            { name: 'Lootboxes', value: 'lootbox' }
                        ]
                    }
                ]
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
            },
            {
                name: 'sell',
                description: 'Sell an item from your inventory (50% value).',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: 'item',
                        description: 'The item to sell.',
                        type: ApplicationCommandOptionType.String,
                        required: true,
                        autocomplete: true
                    },
                    {
                        name: 'amount',
                        description: 'How many to sell (default 1).',
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
            const typeFilter = interaction.options.getString('type');
            
            // Build query based on filter
            let query = 'SELECT * FROM items';
            let params = [];
            
            if (typeFilter) {
                query += ' WHERE type = ?';
                params.push(typeFilter);
            }
            
            query += ' ORDER BY type ASC, price ASC';

            db.all(query, params, (err, rows) => {
                if (err) {
                    return interaction.reply({ content: '❌ Database error fetching items.', ephemeral: true });
                }
                
                if (rows.length === 0) {
                     return interaction.reply({ content: '🚫 No items found matching that filter.', ephemeral: true });
                }

                const title = typeFilter 
                    ? `🛒 Wasteland Store - ${typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1)}`
                    : '🛒 Wasteland General Store';

                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setColor('#2ecc71')
                    .setDescription('Welcome, traveler! Here is what we have in stock.');

                let currentFieldCount = 0;
                
                rows.forEach(item => {
                    if (currentFieldCount < 25) {
                        let detail = `*${item.description}*`;
                        if (item.type === 'weapon') detail += `\n⚔️ DMG: ${item.damage}`;
                        if (item.type === 'armor') detail += `\n🛡️ DEF: ${item.defense}`;
                        if (item.effect_full && item.effect_full !== 'none') detail += `\n✨ Effect: ${item.effect_full}`;

                        embed.addFields({
                            name: `${item.emoji} ${item.name} — ${item.price} Caps`,
                            value: detail,
                            inline: true
                        });
                        currentFieldCount++;
                    }
                });
                
                if (rows.length > 25) {
                    embed.setFooter({ text: `Showing top 25 of ${rows.length} items. Filter by type to see more!` });
                } else {
                    embed.setFooter({ text: 'Use /shop buy <item> to purchase.' });
                }

                return interaction.reply({ embeds: [embed] });
            });
        }

        if (subcommand === 'buy') {
            const query = interaction.options.getString('item');
            const amount = interaction.options.getInteger('amount') || 1;
            const userId = interaction.user.id;
            
            // Fetch exact item from DB
            db.get('SELECT * FROM items WHERE id = ?', [query], (err, item) => {
                if (err || !item) {
                     return interaction.reply({ content: '❌ Item not found. Please select from the list.', ephemeral: true });
                }

                const totalCost = item.price * amount;

                db.get('SELECT balance, stat_charisma FROM users WHERE id = ?', [userId], (err, userRow) => {
                    if (err) return interaction.reply({ content: '❌ Database error.', ephemeral: true });
                    


                    const balance = userRow ? userRow.balance : 0;
                    const charisma = userRow ? (userRow.stat_charisma || 1) : 1;
                    
                    // Charisma Discount
                    let discountPercent = Math.min(charisma * 0.01, 0.10); // Max 10% via stats

                    // Tiered Discounts
                    const donatorRole = config.users.donator_role;
                    const boosterRole = config.users.booster_role;

                    if (interaction.member.roles.cache.has(donatorRole)) {
                        discountPercent += 0.10; // +10% for Donators
                    } else if (interaction.member.roles.cache.has(boosterRole)) {
                        discountPercent += 0.05; // +5% for Boosters
                    }

                    const finalCost = Math.floor(totalCost * (1 - discountPercent));

                    if (balance < finalCost) {
                        return interaction.reply({ content: `❌ You need **${finalCost} Caps** to buy this (Short by ${finalCost - balance}).`, ephemeral: true });
                    }

                    // Transaction
                    db.serialize(() => {
                        db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [finalCost, userId]);
                        
                        // Check inventory
                        db.get('SELECT amount FROM inventory WHERE user_id = ? AND item_id = ?', [userId, item.id], (err, invRow) => {
                            if (invRow) {
                                db.run('UPDATE inventory SET amount = amount + ? WHERE user_id = ? AND item_id = ?', [amount, userId, item.id]);
                            } else {
                                db.run('INSERT INTO inventory (user_id, item_id, amount) VALUES (?, ?, ?)', [userId, item.id, amount]);
                            }
                        });
                    });

                    const discountMsg = discountPercent > 0 ? ` (Discount applied: -${Math.floor(discountPercent*100)}%)` : '';
                    interaction.reply({ content: `🛍️ Purchase successful! You bought **${amount}x ${item.emoji} ${item.name}** for **${finalCost} Caps**${discountMsg}.` });
                });
            });
        }

        if (subcommand === 'sell') {
            const itemId = interaction.options.getString('item');
            const amount = interaction.options.getInteger('amount') || 1;
            const userId = interaction.user.id;

            db.get(`SELECT inv.amount, i.name, i.price, i.emoji FROM inventory inv JOIN items i ON inv.item_id = i.id WHERE inv.user_id = ? AND inv.item_id = ?`, [userId, itemId], (err, item) => {
                if (err) return interaction.reply({ content: '❌ Database error.', ephemeral: true });
                if (!item || item.amount < amount) {
                    return interaction.reply({ content: `❌ You don't have enough **${itemId}** to sell! (Have: ${item ? item.amount : 0})`, ephemeral: true });
                }

                // Sell logic: 50% of base price
                const sellPrice = Math.floor((item.price * 0.5) * amount);

                db.serialize(() => {
                    if (item.amount === amount) {
                         db.run('DELETE FROM inventory WHERE user_id = ? AND item_id = ?', [userId, itemId]);
                    } else {
                         db.run('UPDATE inventory SET amount = amount - ? WHERE user_id = ? AND item_id = ?', [amount, userId, itemId]);
                    }
                    
                    db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [sellPrice, userId]);
                });

                interaction.reply({ content: `🤝 Sold **${amount}x ${item.emoji} ${item.name}** for **${sellPrice} Caps**.` });
            });
        }
    },
    // Autocomplete handling
    autocomplete: async (client, interaction) => {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (subcommand === 'buy') {
            // Query DB for name/ID matches
            db.all('SELECT id, name, emoji, price FROM items WHERE name LIKE ? OR id LIKE ? LIMIT 25', [`%${focusedValue}%`, `%${focusedValue}%`], (err, rows) => {
                if (err || !rows) return interaction.respond([]);
                
                const results = rows.map(item => ({
                    name: `${item.emoji} ${item.name}`.slice(0, 100),
                    value: item.id
                }));
                
                interaction.respond(results).catch(() => {});
            });
        } else if (subcommand === 'sell') {
            // Show only user's inventory
             db.all(`SELECT i.name, i.id, i.price, inv.amount FROM inventory inv JOIN items i ON inv.item_id = i.id WHERE inv.user_id = ? AND i.name LIKE ? LIMIT 25`, 
             [userId, `%${focusedValue}%`], (err, rows) => {
                 if (err || !rows) return interaction.respond([]);
                 
                 const results = rows.map(item => ({
                     name: `${item.name} (x${item.amount})`.slice(0, 100),
                     value: item.id
                 }));
                 interaction.respond(results).catch(() => {});
             });
        }
    }
}).toJSON();
