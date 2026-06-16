const db = require('../../utils/EconomyDB');
const { EmbedBuilder } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'leaderboard',
        description: 'See who rules the wasteland.',
        options: [
            {
                name: 'type',
                description: 'What leaderboard to show',
                type: 3, // String
                required: false,
                choices: [
                    { name: '💰 Richest (Caps)', value: 'balance' },
                    { name: '🗣️ Most Active (XP)', value: 'xp' }
                ]
            }
        ]
    },
    run: async (client, interaction) => {
        const type = interaction.options.getString('type') || 'balance';
        const column = type === 'balance' ? 'balance' : 'xp';
        const title = type === 'balance' ? '🏆 Wasteland Richest' : '🏆 Most Talkative Survivors';
        const unit = type === 'balance' ? 'Caps' : 'XP';

        db.all(`SELECT id, ${column} FROM users ORDER BY ${column} DESC LIMIT 10`, [], async (err, rows) => {
            if (err) return interaction.reply({ content: '❌ Database error.', flags: 64 });

            if (!rows || rows.length === 0) {
                return interaction.reply({ content: '🏜️ The wasteland is empty. No data yet.', flags: 64 });
            }

            const description = rows.map((row, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                const val = row[column] || 0;
                return `${medal} <@${row.id}> — **${val.toLocaleString()}** ${unit}`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor('#f1c40f')
                .setTimestamp();

            interaction.reply({ embeds: [embed] });
        });
    }
}).toJSON();
