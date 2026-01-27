const { ApplicationCommandOptionType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const db = require('../../utils/EconomyDB');

module.exports = new ApplicationCommand({
    command: {
        name: 'create-raffle',
        description: 'Create and manage custom raffles with prizes',
        defaultMemberPermissions: PermissionFlagsBits.Administrator.toString(),
        options: [
            {
                name: 'action',
                description: 'Raffle action',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { name: 'new', value: 'new' },
                    { name: 'list', value: 'list' },
                    { name: 'enter', value: 'enter' },
                    { name: 'pick-winner', value: 'pick-winner' },
                    { name: 'delete', value: 'delete' }
                ]
            },
            {
                name: 'title',
                description: 'Raffle title (for "new" action)',
                type: ApplicationCommandOptionType.String,
                required: false
            },
            {
                name: 'prize-type',
                description: 'Type of prize (caps/item/custom)',
                type: ApplicationCommandOptionType.String,
                required: false,
                choices: [
                    { name: 'Caps Bundle', value: 'caps' },
                    { name: 'Shop Item', value: 'item' },
                    { name: 'Custom (Any Prize)', value: 'custom' }
                ]
            },
            {
                name: 'prize-value',
                description: 'Prize amount (caps/item ID) or custom description',
                type: ApplicationCommandOptionType.String,
                required: false
            },
            {
                name: 'entry-cost',
                description: 'Cost to enter in caps (0 = free)',
                type: ApplicationCommandOptionType.Integer,
                required: false,
                minValue: 0
            },
            {
                name: 'duration',
                description: 'How long the raffle lasts',
                type: ApplicationCommandOptionType.String,
                required: false,
                choices: [
                    { name: '1 hour', value: '1h' },
                    { name: '6 hours', value: '6h' },
                    { name: '12 hours', value: '12h' },
                    { name: '24 hours', value: '24h' },
                    { name: '3 days', value: '3d' },
                    { name: '7 days', value: '7d' }
                ]
            },
                required: false,
                min_value: 0
            },
            {
                name: 'max-entries',
                description: 'Maximum number of entries (0 = unlimited)',
                type: ApplicationCommandOptionType.Integer,
                required: false,
                min_value: 0
            },
            {
                name: 'raffle-id',
                description: 'Raffle ID (for other actions)',
                type: ApplicationCommandOptionType.String,
                required: false
            },
            {
                name: 'user',
                description: 'User to add/manage (for enter action)',
                type: ApplicationCommandOptionType.User,
                required: false
            }
        ]
    },
    defer: true,
    run: async (client, interaction) => {
        const action = interaction.options.getString('action');
        const raffleId = interaction.options.getString('raffle-id') || '';

        // Ensure custom_raffles table exists with prize fields
        await new Promise(resolve => {
            db.run(`CREATE TABLE IF NOT EXISTS custom_raffles (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                prize_type TEXT DEFAULT 'custom',
                prize_value TEXT DEFAULT '',
                entry_cost INTEGER DEFAULT 0,
                max_entries INTEGER DEFAULT 0,
                created_by TEXT,
                created_at INTEGER,
                end_time INTEGER DEFAULT 0,
                status TEXT DEFAULT 'open'
            )`, () => resolve());
        });

        // Ensure raffle_entries table exists with donor tracking
        await new Promise(resolve => {
            db.run(`CREATE TABLE IF NOT EXISTS raffle_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                raffle_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                donor_tier TEXT DEFAULT 'none',
                entry_time INTEGER,
                FOREIGN KEY(raffle_id) REFERENCES custom_raffles(id)
            )`, () => resolve());
        });

        // DONATOR TIERS (matching DonorSystem)
        const DONOR_TIERS = {
            'platinum': { badge: '💎', multiplier: 2.5, discount: 0.5 },
            'gold': { badge: '🏆', multiplier: 2.0, discount: 0.4 },
            'silver': { badge: '⭐', multiplier: 1.5, discount: 0.3 },
            'bronze': { badge: '🥉', multiplier: 1.2, discount: 0.2 },
            'none': { badge: '', multiplier: 1.0, discount: 0.0 }
        };

        if (action === 'new') {
            const title = interaction.options.getString('title');
            const prizeType = interaction.options.getString('prize-type') || 'custom';
            const prizeValue = interaction.options.getString('prize-value') || 'Surprise!';
            const entryCost = interaction.options.getInteger('entry-cost') || 0;
            const maxEntries = interaction.options.getInteger('max-entries') || 0;
            const duration = interaction.options.getString('duration') || '24h';

            if (!title) {
                return interaction.editReply({ content: '❌ Please provide a raffle title.' });
            }

            // Parse duration
            const durationMap = {
                '1h': 1 * 60 * 60 * 1000,
                '6h': 6 * 60 * 60 * 1000,
                '12h': 12 * 60 * 60 * 1000,
                '24h': 24 * 60 * 60 * 1000,
                '3d': 3 * 24 * 60 * 60 * 1000,
                '7d': 7 * 24 * 60 * 60 * 1000
            };
            const now = Date.now();
            const endTime = now + (durationMap[duration] || durationMap['24h']);

            const newRaffleId = Date.now().toString();

            await new Promise((resolve) => {
                db.run(
                    `INSERT INTO custom_raffles (id, title, prize_type, prize_value, entry_cost, max_entries, created_by, created_at, end_time) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [newRaffleId, title, prizeType, prizeValue, entryCost, maxEntries, interaction.user.id, now, endTime],
                    () => resolve()
                );
            });

            // Format prize display
            let prizeDisplay = '';
            if (prizeType === 'caps') {
                prizeDisplay = `💰 ${prizeValue} caps`;
            } else if (prizeType === 'item') {
                prizeDisplay = `🎁 Shop Item (ID: ${prizeValue})`;
            } else {
                prizeDisplay = `🎁 ${prizeValue}`;
            }

            // Build donator discount info
            let donatorInfo = '**💎 Donator Bonuses:**\n';
            donatorInfo += '🥉 Bronze: 20% discount | 1.2x odds\n';
            donatorInfo += '⭐ Silver: 30% discount | 1.5x odds\n';
            donatorInfo += '🏆 Gold: 40% discount | 2.0x odds\n';
            donatorInfo += '💎 Platinum: 50% discount | 2.5x odds';

            const priceInfo = entryCost > 0 
                ? `**Price:** ${entryCost} caps per entry\n**Donator Prices:** Bronze ${Math.ceil(entryCost * 0.8)}, Silver ${Math.ceil(entryCost * 0.7)}, Gold ${Math.ceil(entryCost * 0.6)}, Platinum ${Math.ceil(entryCost * 0.5)}`
                : '**Price:** Free entry!';

            // Format countdown
            const timeRemaining = endTime - now;
            const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
            const days = Math.floor(hours / 24);
            let countdownText = '';
            if (days > 0) {
                countdownText = `⏰ **Ends:** <t:${Math.floor(endTime / 1000)}:R> (<t:${Math.floor(endTime / 1000)}:F>)`;
            } else {
                countdownText = `⏰ **Ends:** <t:${Math.floor(endTime / 1000)}:R> (<t:${Math.floor(endTime / 1000)}:T>)`;
            }

            const embed = new EmbedBuilder()
                .setTitle(`🎰 ${title}`)
                .setDescription(prizeDisplay)
                .addFields(
                    { name: '💵 Entry Cost', value: priceInfo, inline: false },
                    { name: donatorInfo.split('\n')[0], value: donatorInfo.split('\n').slice(1).join('\n'), inline: false },
                    { name: '📊 Raffle Info', value: `${countdownText}\nMax Entries: ${maxEntries > 0 ? maxEntries : '∞'}\nID: \`${newRaffleId}\``, inline: false }
                )
                .setColor('#f1c40f')
                .setFooter({ text: 'More entries = Better odds to win! Donators get discounts AND better chances!' });

            // Create entry button
            const enterButton = new ButtonBuilder()
                .setCustomId(`raffle_enter_${newRaffleId}`)
                .setLabel('Enter Raffle')
                .setStyle(ButtonStyle.Success);

            const viewButton = new ButtonBuilder()
                .setCustomId(`raffle_view_${newRaffleId}`)
                .setLabel('View Entries')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(enterButton, viewButton);

            // Post the raffle embed in current channel
            const postedMessage = await interaction.channel.send({ embeds: [embed], components: [row] });

            const confirmEmbed = new EmbedBuilder()
                .setTitle('✅ Raffle Created!')
                .addFields(
                    { name: '🎰 Title', value: title, inline: true },
                    { name: '🎁 Prize', value: prizeDisplay, inline: true },
                    { name: '💰 Entry Cost', value: entryCost > 0 ? `${entryCost} caps` : 'Free', inline: true },
                    { name: '👥 Max Entries', value: maxEntries > 0 ? maxEntries.toString() : 'Unlimited', inline: true },
                    { name: '🔗 Raffle ID', value: `\`${newRaffleId}\``, inline: false },
                    { name: '📍 Posted At', value: `[Jump to raffle](${postedMessage.url})`, inline: false }
                )
                .setColor('#2ecc71')
                .setFooter({ text: 'Players can now interact with the raffle via buttons!' });

            return interaction.editReply({ embeds: [confirmEmbed], flags: 64 });
        }

        if (action === 'list') {
            const raffles = await new Promise((resolve) => {
                db.all(
                    `SELECT * FROM custom_raffles WHERE status = 'open' ORDER BY created_at DESC`,
                    (err, rows) => resolve(rows || [])
                );
            });

            if (raffles.length === 0) {
                return interaction.editReply({ content: '❌ No active raffles at the moment.' });
            }

            let desc = '';
            for (const raffle of raffles) {
                const entryCount = await new Promise((resolve) => {
                    db.get(`SELECT COUNT(*) as count FROM raffle_entries WHERE raffle_id = ?`, [raffle.id], (err, row) => {
                        resolve(row?.count || 0);
                    });
                });

                let prizeDisplay = '';
                if (raffle.prize_type === 'caps') {
                    prizeDisplay = `🎁 ${raffle.prize_value} caps`;
                } else if (raffle.prize_type === 'item') {
                    prizeDisplay = `🎁 Shop Item (ID: ${raffle.prize_value})`;
                } else {
                    prizeDisplay = `🎁 ${raffle.prize_value}`;
                }

                const maxInfo = raffle.max_entries > 0 ? `/${raffle.max_entries}` : '/∞';
                desc += `**${raffle.title}**\n`;
                desc += `├ ${prizeDisplay}\n`;
                desc += `├ Entries: ${entryCount}${maxInfo} | Cost: ${raffle.entry_cost > 0 ? raffle.entry_cost + ' caps' : 'Free'}\n`;
                desc += `└ ID: \`${raffle.id}\`\n\n`;
            }

            const embed = new EmbedBuilder()
                .setTitle('🎰 Active Raffles')
                .setDescription(desc)
                .setColor('#f1c40f')
                .setFooter({ text: `Total: ${raffles.length} active raffle(s) | Donators get entry discounts!` });

            return interaction.editReply({ embeds: [embed] });
        }

        if (action === 'enter') {
            if (!raffleId) {
                return interaction.editReply({ content: '❌ Please provide a raffle ID.' });
            }

            const targetUser = interaction.options.getUser('user') || interaction.user;
            const raffle = await new Promise((resolve) => {
                db.get(`SELECT * FROM custom_raffles WHERE id = ?`, [raffleId], (err, row) => {
                    resolve(row);
                });
            });

            if (!raffle || raffle.status !== 'open') {
                return interaction.editReply({ content: '❌ Raffle not found or is closed.' });
            }

            // Check max entries
            if (raffle.max_entries > 0) {
                const entryCount = await new Promise((resolve) => {
                    db.get(
                        `SELECT COUNT(*) as count FROM raffle_entries WHERE raffle_id = ?`,
                        [raffleId],
                        (err, row) => resolve(row?.count || 0)
                    );
                });

                if (entryCount >= raffle.max_entries) {
                    return interaction.editReply({ content: `❌ Raffle is full (${raffle.max_entries}/${raffle.max_entries} entries).` });
                }
            }

            // Get donator tier
            let donorTier = 'none';
            const donor = await new Promise((resolve) => {
                db.get(`SELECT tier FROM donors WHERE user_id = ?`, [targetUser.id], (err, row) => {
                    resolve(row);
                });
            });
            if (donor) {
                donorTier = donor.tier;
            }

            const tierInfo = DONOR_TIERS[donorTier] || DONOR_TIERS['none'];
            let entryFee = raffle.entry_cost;
            
            // Apply donator discount
            if (donorTier !== 'none') {
                entryFee = Math.ceil(raffle.entry_cost * (1 - tierInfo.discount));
            }

            // FIX 3: ATOMIC TRANSACTION - Deduct balance with WHERE clause to prevent race condition
            if (entryFee > 0) {
                const result = await new Promise((resolve) => {
                    db.run(
                        `UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?`,
                        [entryFee, targetUser.id, entryFee],
                        function(err) {
                            resolve({ changes: this.changes, err });
                        }
                    );
                });

                if (result.changes === 0) {
                    const userData = await new Promise((resolve) => {
                        db.get(`SELECT balance FROM users WHERE id = ?`, [targetUser.id], (err, row) => {
                            resolve(row || { balance: 0 });
                        });
                    });
                    return interaction.editReply({
                        content: `❌ <@${targetUser.id}> needs ${entryFee} caps to enter. They only have ${userData.balance} caps.`
                    });
                }
            }

            // Add entry with donor tracking
            await new Promise((resolve) => {
                db.run(
                    `INSERT INTO raffle_entries (raffle_id, user_id, donor_tier, entry_time) VALUES (?, ?, ?, ?)`,
                    [raffleId, targetUser.id, donorTier, Date.now()],
                    () => resolve()
                );
            });

            // Get current entry count for this user
            const userEntryCount = await new Promise((resolve) => {
                db.get(
                    `SELECT COUNT(*) as count FROM raffle_entries WHERE raffle_id = ? AND user_id = ?`,
                    [raffleId, targetUser.id],
                    (err, row) => resolve(row?.count || 0)
                );
            });

            let prizeDisplay = '';
            if (raffle.prize_type === 'caps') {
                prizeDisplay = `🎁 Prize: ${raffle.prize_value} caps`;
            } else if (raffle.prize_type === 'item') {
                prizeDisplay = `🎁 Prize: Shop Item (ID: ${raffle.prize_value})`;
            } else {
                prizeDisplay = `🎁 Prize: ${raffle.prize_value}`;
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Successfully Entered!')
                .setDescription(raffle.title)
                .addFields(
                    { name: '🎁 Prize', value: prizeDisplay, inline: false },
                    { name: '🎟️ Your Total Entries', value: userEntryCount.toString(), inline: true },
                    { name: '💰 Cost Paid', value: entryFee > 0 ? `${entryFee} caps` : 'Free', inline: true }
                )
                .setColor('#2ecc71')
                .setFooter({ text: 'More entries = Better odds to win!' });

            if (donorTier !== 'none') {
                const savings = raffle.entry_cost - entryFee;
                embed.addFields(
                    { name: '💎 Donator Bonus Applied', value: `${tierInfo.badge} Saved ${savings} caps! You have ${(tierInfo.multiplier * 100).toFixed(0)}% better odds!`, inline: false }
                );
            }

            return interaction.editReply({ embeds: [embed] });
        }

        if (action === 'pick-winner') {
            if (!raffleId) {
                return interaction.editReply({ content: '❌ Please provide a raffle ID.' });
            }

            const raffle = await new Promise((resolve) => {
                db.get(`SELECT * FROM custom_raffles WHERE id = ?`, [raffleId], (err, row) => {
                    resolve(row);
                });
            });

            if (!raffle) {
                return interaction.editReply({ content: '❌ Raffle not found.' });
            }

            const entries = await new Promise((resolve) => {
                db.all(
                    `SELECT user_id, donor_tier FROM raffle_entries WHERE raffle_id = ?`,
                    [raffleId],
                    (err, rows) => resolve(rows || [])
                );
            });

            if (entries.length === 0) {
                return interaction.editReply({ content: '❌ No entries in this raffle.' });
            }

            // Create weighted pool (donators get multiplied entries)
            const weightedPool = [];
            for (const entry of entries) {
                const tierInfo = DONOR_TIERS[entry.donor_tier] || DONOR_TIERS['none'];
                const weight = Math.max(1, Math.round(tierInfo.multiplier));
                for (let i = 0; i < weight; i++) {
                    weightedPool.push(entry.user_id);
                }
            }

            // Pick random winner from weighted pool
            const winnerId = weightedPool[Math.floor(Math.random() * weightedPool.length)];

            // Count entries and winner's entries
            const winnerEntries = entries.filter(e => e.user_id === winnerId).length;
            const totalEntries = entries.length;
            const winChance = ((winnerEntries / totalEntries) * 100).toFixed(1);

            // Get winner's donor tier
            const winnerDonor = await new Promise((resolve) => {
                db.get(`SELECT tier FROM donors WHERE user_id = ?`, [winnerId], (err, row) => {
                    resolve(row?.tier || 'none');
                });
            });

            const winnerTierInfo = DONOR_TIERS[winnerDonor];

            // Distribute prize
            if (raffle.prize_type === 'caps') {
                const capAmount = parseInt(raffle.prize_value);
                await new Promise((resolve) => {
                    db.run(
                        `UPDATE users SET balance = balance + ? WHERE id = ?`,
                        [capAmount, winnerId],
                        () => resolve()
                    );
                });
            } else if (raffle.prize_type === 'item') {
                const itemId = raffle.prize_value;
                await new Promise((resolve) => {
                    db.run(
                        `INSERT INTO inventory (user_id, item_id, amount) VALUES (?, ?, 1)
                         ON CONFLICT(user_id, item_id) DO UPDATE SET amount = amount + 1`,
                        [winnerId, itemId],
                        () => resolve()
                    );
                });
            }

            // Mark raffle as closed
            await new Promise((resolve) => {
                db.run(`UPDATE custom_raffles SET status = 'closed' WHERE id = ?`, [raffleId], () => resolve());
            });

            // Format prize display
            let prizeDisplay = '';
            if (raffle.prize_type === 'caps') {
                prizeDisplay = `💰 ${raffle.prize_value} caps`;
            } else if (raffle.prize_type === 'item') {
                prizeDisplay = `🎁 Shop Item (ID: ${raffle.prize_value})`;
            } else {
                prizeDisplay = `🎁 ${raffle.prize_value}`;
            }

            const embed = new EmbedBuilder()
                .setTitle('🎉 Raffle Winner Selected!')
                .setDescription(raffle.title)
                .addFields(
                    { name: '🏆 Winner', value: `<@${winnerId}>`, inline: false },
                    { name: '🎁 Prize', value: prizeDisplay, inline: false },
                    { name: '🎟️ Winner\'s Entries', value: winnerEntries.toString(), inline: true },
                    { name: '👥 Total Entries', value: totalEntries.toString(), inline: true },
                    { name: '📊 Win Chance', value: `${winChance}%`, inline: true }
                )
                .setColor('#FFD700')
                .setFooter({ text: 'Weighted selection - donators have better odds!' });

            if (winnerDonor !== 'none') {
                embed.addFields(
                    { name: '💎 Donator Bonus Applied', value: `${winnerTierInfo.badge} This player had ${(winnerTierInfo.multiplier * 100).toFixed(0)}% better odds!`, inline: false }
                );
            }

            return interaction.editReply({ embeds: [embed] });
        }

        if (action === 'delete') {
            if (!raffleId) {
                return interaction.editReply({ content: '❌ Please provide a raffle ID.' });
            }

            await new Promise((resolve) => {
                db.run(`DELETE FROM raffle_entries WHERE raffle_id = ?`, [raffleId], () => resolve());
            });

            await new Promise((resolve) => {
                db.run(`DELETE FROM custom_raffles WHERE id = ?`, [raffleId], () => resolve());
            });

            return interaction.editReply({ content: `✅ Raffle \`${raffleId}\` has been deleted.` });
        }
    }
}).toJSON();
