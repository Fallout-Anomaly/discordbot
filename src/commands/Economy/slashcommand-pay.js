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
            return interaction.reply({ content: '❌ You cannot pay yourself.', ephemeral: true });
        }

        db.get('SELECT balance FROM users WHERE id = ?', [senderId], (err, row) => {
            if (err) return interaction.reply({ content: '❌ Database error.', ephemeral: true });

            const currentBalance = row ? row.balance : 0;

            if (currentBalance < amount) {
                return interaction.reply({ 
                    content: `❌ You don't have enough Caps to cover that transaction. Balance: **${currentBalance}**`, 
                    ephemeral: true 
                });
            }

            // Transaction
            db.serialize(() => {
                db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, senderId]);
                
                // Ensure target exists
                db.run('INSERT OR IGNORE INTO users (id, balance) VALUES (?, 0)', [targetId]);
                db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, targetId]);
            });

            interaction.reply({ 
                content: `💸 Transaction Complete!\n**${interaction.user.username}** paid **${amount}** Caps to **${target.username}**.` 
            });
        });
    }
}).toJSON();
