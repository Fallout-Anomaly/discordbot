const db = require('../../utils/EconomyDB');
const { ApplicationCommandOptionType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'pay',
        description: 'Give your caps to another survivor.',
        options: [
            {
                name: 'user',
                description: 'Who to give caps to',
                type: ApplicationCommandOptionType.User,
                required: true
            },
            {
                name: 'amount',
                description: 'Amount of Caps',
                type: ApplicationCommandOptionType.Integer,
                required: true,
                minValue: 1
            }
        ]
    },
    run: async (client, interaction) => {
        const amount = interaction.options.getInteger('amount');
        const target = interaction.options.getUser('user');
        const senderId = interaction.user.id;
        const targetId = target.id;

        if (senderId === targetId) {
            return interaction.reply({ content: '❌ You cannot pay yourself.', flags: 64 });
        }

        if (amount <= 0) {
            return interaction.reply({ content: '❌ Amount must be greater than 0.', flags: 64 });
        }

        // ATOMIC DEDUCTION: Check balance and deduct in a single operation
        // This prevents race conditions where multiple requests could spend the same balance
        db.run(
            'UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?',
            [amount, senderId, amount],
            function (err) {
                if (err) return interaction.reply({ content: '❌ Database error.', flags: 64 });

                // If this.changes is 0, the WHERE clause failed (insufficient funds)
                if (this.changes === 0) {
                    // Fetch actual balance for user feedback
                    db.get('SELECT balance FROM users WHERE id = ?', [senderId], (err, row) => {
                        const currentBalance = row ? (row.balance ?? 0) : 0;
                        return interaction.reply({ 
                            content: `❌ You don't have enough Caps to cover that transaction. Balance: **${currentBalance}**`, 
                            ephemeral: true 
                        });
                    });
                    return;
                }

                // Deduction successful, now safely credit target
                db.serialize(() => {
                    // Ensure target exists
                    db.run('INSERT OR IGNORE INTO users (id, balance) VALUES (?, 0)', [targetId]);
                    db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, targetId]);
                });

                interaction.reply({ 
                    content: `💸 Transaction Complete!\n**${interaction.user.username}** paid **${amount}** Caps to **${target.username}**.` 
                });
            }
        );
    }
}).toJSON();
