const db = require('../../utils/EconomyDB');
const { ApplicationCommandOptionType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");

const COINFLIP_COOLDOWN = 10 * 60 * 1000; // 10 minutes in milliseconds
const coinflipCooldowns = new Map();

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
    defer: { flags: 64 },
    run: async (client, interaction) => {
        const amount = interaction.options.getInteger('amount');
        const userId = interaction.user.id;

        if (amount <= 0) {
            return interaction.editReply({ content: '❌ Bet amount must be greater than 0.' });
        }

        // Check cooldown
        const now = Date.now();
        if (coinflipCooldowns.has(userId)) {
            const expirationTime = coinflipCooldowns.get(userId);
            if (now < expirationTime) {
                const timeLeft = Math.ceil((expirationTime - now) / 1000);
                const minutes = Math.floor(timeLeft / 60);
                const seconds = timeLeft % 60;
                return interaction.editReply({ 
                    content: `⏱️ You need to wait **${minutes}m ${seconds}s** before gambling again!`
                });
            }
        }

        // Get user's LUCK stat for win calculation
        const userData = await new Promise((resolve) => {
            db.get('SELECT balance, stat_luck FROM users WHERE id = ?', [userId], (err, row) => {
                if (row) {
                    resolve({
                        balance: row.balance ?? 0,
                        stat_luck: row.stat_luck ?? 1
                    });
                } else {
                    resolve({ balance: 0, stat_luck: 1 });
                }
            });
        });

        if (userData.balance < amount) {
            return interaction.editReply({ 
                content: `❌ You're broke! You only have **${userData.balance}** Caps.`
            });
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
                    return interaction.editReply({ 
                        content: `❌ You're broke! You only have **${userData.balance}** Caps.`
                    });
                }

                // Set cooldown after successful bet deduction
                coinflipCooldowns.set(userId, now + COINFLIP_COOLDOWN);
                setTimeout(() => coinflipCooldowns.delete(userId), COINFLIP_COOLDOWN);

                // Calculate win chance based on LUCK stat
                // Base win rate: 35% (house advantage)
                // Each point of LUCK adds 1% (max 10 LUCK = 45% win rate)
                // This means even with max luck, player has slight disadvantage
                const luck = userData.stat_luck || 1;
                const winChance = 0.35 + (luck * 0.01); // 36% at 1 luck, 45% at 10 luck
                const won = Math.random() < winChance;

                if (won) {
                    // Give back the bet + the win (total payout = amount * 2)
                    const payout = amount * 2;
                    db.run(
                        'UPDATE users SET balance = balance + ? WHERE id = ?',
                        [payout, userId],
                        () => {
                            interaction.editReply({ 
                                content: `🪙 **HEADS!** You **WON** **${amount}** Caps!\nYour new balance: check with \`/balance\`\n\n*Win chance: ${Math.round(winChance * 100)}% (${luck} LUCK)*`
                            });
                        }
                    );
                } else {
                    // Money already deducted, just notify loss
                    interaction.editReply({ 
                        content: `💀 **TAILS!** You **LOST** **${amount}** Caps. Better luck next time!\n\n*Win chance was: ${Math.round(winChance * 100)}% (${luck} LUCK)*` 
                    });
                }
            }
        );
    }
}).toJSON();
