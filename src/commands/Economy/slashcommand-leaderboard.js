const db = require('../../utils/EconomyDB');
const { EmbedBuilder } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'leaderboard',
        description: 'See who rules the wasteland economy.',
    },
    run: async (client, interaction) => {
        db.all('SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10', [], async (err, rows) => {
            if (err) return interaction.reply({ content: '❌ Database error.', ephemeral: true });

            if (!rows || rows.length === 0) {
                return interaction.reply({ content: '🏜️ The wasteland is empty. No data yet.', ephemeral: true });
            }

            const description = rows.map((row, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                return `${medal} <@${row.id}> — **${row.balance.toLocaleString()}** Caps`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle('🏆 Wasteland Richest')
                .setDescription(description)
                .setColor('#f1c40f')
                .setTimestamp();

            interaction.reply({ embeds: [embed] });
        });
    }
}).toJSON();
