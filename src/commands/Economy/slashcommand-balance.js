const db = require('../../utils/EconomyDB');
const { ApplicationCommandOptionType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'balance',
        description: 'Check your bottle cap balance.',
        options: [
            {
                name: 'user',
                description: 'User to check balance of',
                type: ApplicationCommandOptionType.User,
                required: false
            }
        ]
    },
    run: async (client, interaction) => {
        const target = interaction.options.getUser('user') || interaction.user;

        db.get('SELECT balance FROM users WHERE id = ?', [target.id], (err, row) => {
            if (err) {
                console.error(err);
                return interaction.reply({ content: '❌ Database error.', ephemeral: true });
            }

            const balance = row ? (row.balance ?? 0) : 0;

            // If user doesn't exist, create them
            if (!row) {
                db.run('INSERT INTO users (id, balance) VALUES (?, ?)', [target.id, 0]);
            }

            return interaction.reply({
                content: `💰 **${target.username}** has **${balance}** Bottle Caps.`
            });
        });
    }
}).toJSON();
