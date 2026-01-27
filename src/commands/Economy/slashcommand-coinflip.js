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
    run: async (client, interaction) => {
        const amount = interaction.options.getInteger('amount');
        const userId = interaction.user.id;

        db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, row) => {
            if (err) return interaction.reply({ content: '❌ Database error.', ephemeral: true });

            const currentBalance = row ? row.balance : 0;

            if (currentBalance < amount) {
                return interaction.reply({ 
                    content: `❌ You're broke! You only have **${currentBalance}** Caps.`, 
                    ephemeral: true 
                });
            }

            // 50/50 Chance
            const won = Math.random() >= 0.5;
            const newBalance = won ? currentBalance + amount : currentBalance - amount;

            db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, userId], (updateErr) => {
                if (updateErr) return interaction.reply({ content: '❌ Update error.', ephemeral: true });

                const msg = won 
                    ? `🪙 Heaps of caps! You **WON** **${amount}** Caps!\nYour new balance: **${newBalance}**`
                    : `💀 Bad luck, courier. You **LOST** **${amount}** Caps.\nYour new balance: **${newBalance}**`;

                interaction.reply({ content: msg });
            });
        });
    }
}).toJSON();
