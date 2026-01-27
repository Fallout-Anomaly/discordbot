const { EmbedBuilder } = require('discord.js');
const Component = require('../../structure/Component');
const db = require('../../utils/EconomyDB');

module.exports = new Component({
    customId: /^raffle_(enter|view)_/,
    type: 'button',
    options: {
        public: true
    },
    async run(client, interaction) {
        const [, action, raffleId] = interaction.customId.match(/^raffle_(enter|view)_(.+)$/);

        // Defer the interaction ephemeral
        await interaction.deferReply({ flags: 64 });

        // DONATOR TIERS (matching DonorSystem)
        const DONOR_TIERS = {
            'platinum': { badge: '💎', multiplier: 2.5, discount: 0.5 },
            'gold': { badge: '🏆', multiplier: 2.0, discount: 0.4 },
            'silver': { badge: '⭐', multiplier: 1.5, discount: 0.3 },
            'bronze': { badge: '🥉', multiplier: 1.2, discount: 0.2 },
            'none': { badge: '', multiplier: 1.0, discount: 0.0 }
        };

        let raffle = await new Promise((resolve) => {
            db.get(`SELECT * FROM custom_raffles WHERE id = ?`, [raffleId], (err, row) => {
                resolve(row);
            });
        });

        if (!raffle || raffle.status !== 'open') {
            return interaction.editReply({ content: '❌ Raffle not found or is closed.' });
        }

        if (action === 'view') {
            // Get all entries and count
            const entries = await new Promise((resolve) => {
                db.all(
                    `SELECT user_id, donor_tier, COUNT(*) as count FROM raffle_entries WHERE raffle_id = ? GROUP BY user_id`,
                    [raffleId],
                    (err, rows) => resolve(rows || [])
                );
            });

            const totalEntries = entries.reduce((sum, e) => sum + e.count, 0);

            let entriesDisplay = '';
            if (entries.length === 0) {
                entriesDisplay = 'No entries yet. Be the first to enter!';
            } else {
                // Sort by entry count (descending)
                entries.sort((a, b) => b.count - a.count);
                for (const entry of entries.slice(0, 10)) {
                    const tierInfo = DONOR_TIERS[entry.donor_tier] || DONOR_TIERS['none'];
                    const tierLabel = entry.donor_tier !== 'none' ? ` ${tierInfo.badge}` : '';
                    entriesDisplay += `<@${entry.user_id}>${tierLabel}: ${entry.count} entry${entry.count > 1 ? 'ies' : ''}\n`;
                }
                if (entries.length > 10) {
                    entriesDisplay += `\n... and ${entries.length - 10} more players`;
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`📊 ${raffle.title} - Entry Status`)
                .setDescription(entriesDisplay)
                .addFields(
                    { name: '📈 Total Entries', value: totalEntries.toString(), inline: true },
                    { name: '👥 Unique Players', value: entries.length.toString(), inline: true },
                    { name: '📍 Max Entries', value: raffle.max_entries > 0 ? `${totalEntries}/${raffle.max_entries}` : `${totalEntries}/∞`, inline: true }
                )
                .setColor('#3498db')
                .setFooter({ text: 'More entries = Better odds to win!' });

            return interaction.editReply({ embeds: [embed] });
        }

        if (action === 'enter') {
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
                db.get(`SELECT tier FROM donors WHERE user_id = ?`, [interaction.user.id], (err, row) => {
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

            // Check entry cost
            if (entryFee > 0) {
                const userData = await new Promise((resolve) => {
                    db.get(`SELECT balance FROM users WHERE id = ?`, [interaction.user.id], (err, row) => {
                        resolve(row || { balance: 0 });
                    });
                });

                if (userData.balance < entryFee) {
                    return interaction.editReply({
                        content: `❌ You need ${entryFee} caps to enter. You only have ${userData.balance} caps.`
                    });
                }

                // Deduct cost
                await new Promise((resolve) => {
                    db.run(
                        `UPDATE users SET balance = balance - ? WHERE id = ?`,
                        [entryFee, interaction.user.id],
                        () => resolve()
                    );
                });
            }

            // Add entry with donor tracking
            await new Promise((resolve) => {
                db.run(
                    `INSERT INTO raffle_entries (raffle_id, user_id, donor_tier, entry_time) VALUES (?, ?, ?, ?)`,
                    [raffleId, interaction.user.id, donorTier, Date.now()],
                    () => resolve()
                );
            });

            // Get current entry count for this user
            let userEntryCount = await new Promise((resolve) => {
                db.get(
                    `SELECT COUNT(*) as count FROM raffle_entries WHERE raffle_id = ? AND user_id = ?`,
                    [raffleId, interaction.user.id],
                    (err, row) => resolve(row?.count || 0)
                );
            });

            let prizeDisplay = '';
            if (raffle.prize_type === 'caps') {
                prizeDisplay = `💰 ${raffle.prize_value} caps`;
            } else if (raffle.prize_type === 'item') {
                prizeDisplay = `🎁 Shop Item (ID: ${raffle.prize_value})`;
            } else {
                prizeDisplay = `🎁 ${raffle.prize_value}`;
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
    }
});
