const db = require('../../utils/EconomyDB');
const { ApplicationCommandOptionType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'coinflip',
        description: 'Double or nothing! Bet your caps on a coin flip.',
        options: [
            {
                name: 'amount',
                description: 'Amount of Caps to bet',
                type: ApplicationCommandOptionType.Integer,
                required: true,
                minValue: 1
            }
        ]
    },
    defer: 'ephemeral',
    run: async (client, interaction) => {
        const amount = interaction.options.getInteger('amount');
        const userId = interaction.user.id;

        if (amount <= 0) {
            return interaction.editReply({ content: '❌ Bet amount must be greater than 0.' });
        }

        // ATOMIC DEDUCTION: Check balance and deduct in a single operation
        // This prevents double-spending where multiple requests could use the same balance
        db.run(
            'UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?',
            [amount, userId, amount],
            function (err) {
                if (err) return interaction.editReply({ content: '❌ Database error.' });

                // If this.changes is 0, the WHERE clause failed (insufficient funds)
                if (this.changes === 0) {
                    db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, row) => {
                        const currentBalance = row ? row.balance : 0;
                        return interaction.editReply({ 
                            content: `❌ You're broke! You only have **${currentBalance}** Caps.`
                        });
                    });
                    return;
                }

                // Deduction successful, now flip the coin
                const won = Math.random() >= 0.5;

                if (won) {
                    // Give back the bet + the win (total payout = amount * 2)
                    const payout = amount * 2;
                    db.run(
                        'UPDATE users SET balance = balance + ? WHERE id = ?',
                        [payout, userId],
                        () => {
                            interaction.editReply({ 
                                content: `🪙 **HEADS!** You **WON** **${amount}** Caps!\nYour new balance: **${payout}** (previous balance + ${amount})`
                            });
                        }
                    );
                } else {
                    // Money already deducted, just notify loss
                    interaction.editReply({ 
                        content: `💀 **TAILS!** You **LOST** **${amount}** Caps. Better luck next time!` 
                    });
                }
            }
        );
    }
}).toJSON();
