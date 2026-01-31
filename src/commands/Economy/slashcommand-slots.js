const db = require('../../utils/EconomyDB');
const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'slots',
        description: 'Spin the reels to win big prizes!',
        options: [
            {
                name: 'amount',
                description: 'Amount of Caps to bet',
                type: ApplicationCommandOptionType.Integer,
                required: true,
                minValue: 10
            }
        ]
    },
    defer: { flags: 64 },
    run: async (client, interaction) => {
        const amount = interaction.options.getInteger('amount');
        const userId = interaction.user.id;

        if (amount <= 0) {
            return interaction.editReply({ content: '❌ Bet amount must be greater than 0.' });
        }

        const items = ['🍒', '🍋', '🍇', '🍉', '🔔', '💎', '7️⃣'];
        
        // Weights: 7 is rarest, Cherry is common
        function spinReel() {
            return items[Math.floor(Math.random() * items.length)];
        }

        // ATOMIC DEDUCTION: Check balance and deduct in a single operation
        // This prevents double-spending where multiple spins could use the same balance
        db.run(
            'UPDATE users SET balance = IFNULL(balance, 0) - ? WHERE id = ? AND IFNULL(balance, 0) >= ?',
            [amount, userId, amount],
            function (err) {
                if (err) return interaction.editReply({ content: '❌ Database error.' });

                // If this.changes is 0, the WHERE clause failed (insufficient funds)
                if (this.changes === 0) {
                    db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, row) => {
                        const currentBalance = row ? (row.balance ?? 0) : 0;
                        return interaction.editReply({ 
                            content: `❌ You entered the casino with empty pockets. You have **${currentBalance}** Caps.`
                        });
                    });
                    return;
                }

                // Deduction successful, now spin
                const r1 = spinReel();
                const r2 = spinReel();
                const r3 = spinReel();

                // Calculate Winnings
                let winnings = 0;
                let multiplier = 0;

                if (r1 === r2 && r2 === r3) {
                    // Jackpot (3 of a kind)
                    if (r1 === '7️⃣') multiplier = 50;
                    else if (r1 === '💎') multiplier = 25;
                    else if (r1 === '🔔') multiplier = 15;
                    else multiplier = 10;
                } else if (r1 === r2 || r2 === r3 || r1 === r3) {
                    // Small prize (2 of a kind)
                    multiplier = 2;
                }

                winnings = amount * multiplier;

                // Update DB if won (using atomic increment)
                if (winnings > 0) {
                    db.run('UPDATE users SET balance = IFNULL(balance, 0) + ? WHERE id = ?', [winnings, userId]);
                }

                // Build Embed
                const embed = new EmbedBuilder()
                    .setTitle('🎰 LUCKY 38 SLOTS 🎰')
                    .setDescription(`**[ ${r1} | ${r2} | ${r3} ]**`)
                    .setColor(winnings > 0 ? '#2ecc71' : '#e74c3c')
                    .addFields(
                        { name: 'Bet', value: `${amount} Caps`, inline: true },
                        { name: 'Multiplier', value: `${multiplier}x`, inline: true },
                        { name: 'Winnings', value: `${winnings} Caps`, inline: true }
                    )
                    .setFooter({ text: winnings > 0 ? 'WINNER WINNER!' : 'Better luck next time, courier.' });

                interaction.editReply({ embeds: [embed] });
            }
        );
    }
}).toJSON();
