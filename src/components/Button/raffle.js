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

        // interactionCreate already defers component interactions ephemerally;
        // only defer here if that hasn't happened (avoids "already replied").
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: 64 }).catch(() => {});
        }

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

            // Privacy: Don't show individual entries
            const entriesDisplay = totalEntries === 0 
                ? 'No entries yet. Be the first to enter!' 
                : 'Participant details are hidden for privacy. Good luck to all participants!';

            // Format countdown
            const now = Date.now();
            let countdownText = 'No time limit';
            if (raffle.end_time && raffle.end_time > now) {
                countdownText = `<t:${Math.floor(raffle.end_time / 1000)}:R>`;
            } else if (raffle.end_time && raffle.end_time <= now) {
                countdownText = '⚠️ Raffle ended - awaiting winner selection';
            }

            const embed = new EmbedBuilder()
                .setTitle(`📊 ${raffle.title} - Entry Status`)
                .setDescription(entriesDisplay)
                .addFields(
                    { name: '⏰ Time Left', value: countdownText, inline: true },
                    { name: '📈 Total Entries', value: totalEntries.toString(), inline: true },
                    { name: '👥 Unique Players', value: entries.length.toString(), inline: true },
                    { name: '📍 Max Entries', value: raffle.max_entries > 0 ? `${totalEntries}/${raffle.max_entries}` : `${totalEntries}/∞`, inline: true }
                )
                .setColor('#3498db')
                .setFooter({ text: 'More entries = Better odds to win!' });

            return interaction.editReply({ embeds: [embed] });
        }

        if (action === 'enter') {
            // Check if raffle has ended
            const now = Date.now();
            if (raffle.end_time && raffle.end_time <= now) {
                return interaction.editReply({ content: '❌ This raffle has ended. No more entries allowed.' });
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

                // Atomically deduct the fee; if it fails (insufficient / raced),
                // don't record the entry.
                const paid = await new Promise((resolve) => {
                    db.run(
                        `UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?`,
                        [entryFee, interaction.user.id, entryFee],
                        function () { resolve(this.changes > 0); }
                    );
                });
                if (!paid) {
                    return interaction.editReply({ content: `❌ You don't have ${entryFee} caps to enter anymore.` });
                }
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
