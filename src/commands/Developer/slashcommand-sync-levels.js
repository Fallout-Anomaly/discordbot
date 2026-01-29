const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const { calculateLevel } = require('../../utils/LevelSystem');

module.exports = new ApplicationCommand({
    command: {
        name: 'sync-levels',
        description: '[ADMIN] Sync all user level columns with their actual XP-calculated levels.',
        options: [
            {
                name: 'preview',
                description: 'Preview changes without applying them',
                type: ApplicationCommandOptionType.Boolean,
                required: false
            }
        ]
    },
    defer: 'ephemeral',
    developer: true,
    run: async (client, interaction) => {
        const db = require('../../utils/EconomyDB');
        const preview = interaction.options.getBoolean('preview') || false;

        // Get all users
        const users = await new Promise((resolve) => {
            db.all('SELECT id, xp, level FROM users', (err, rows) => {
                if (err) {
                    console.error('Database error:', err);
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            });
        });

        if (users.length === 0) {
            return interaction.editReply({ 
                content: '❌ No users found in database.' 
            });
        }

        let updated = 0;
        let unchanged = 0;
        let mismatches = [];

        for (const user of users) {
            const xp = user.xp || 0;
            const dbLevel = user.level || 1;
            const calculatedLevel = calculateLevel(xp);

            if (dbLevel !== calculatedLevel) {
                mismatches.push({
                    id: user.id,
                    xp: xp,
                    dbLevel: dbLevel,
                    calculatedLevel: calculatedLevel,
                    diff: calculatedLevel - dbLevel
                });

                if (!preview) {
                    await new Promise((resolve) => {
                        db.run(
                            'UPDATE users SET level = ? WHERE id = ?',
                            [calculatedLevel, user.id],
                            () => resolve()
                        );
                    });
                }
                updated++;
            } else {
                unchanged++;
            }
        }

        const embed = new EmbedBuilder()
            .setTitle(preview ? '🔍 Level Sync Preview' : '✅ Level Sync Complete')
            .setDescription(preview ? 'This shows what would be changed without actually modifying the database.' : 'Successfully synchronized all user levels with their XP values.')
            .addFields(
                { name: 'Total Users', value: `${users.length}`, inline: true },
                { name: 'To Update', value: `${updated}`, inline: true },
                { name: 'Already Correct', value: `${unchanged}`, inline: true }
            )
            .setColor(preview ? '#FFA500' : '#00ff00')
            .setFooter({ text: `Executed by ${interaction.user.tag}` })
            .setTimestamp();

        if (mismatches.length > 0) {
            // Show top 10 mismatches
            const top10 = mismatches
                .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
                .slice(0, 10);

            const mismatchText = top10.map(m => 
                `<@${m.id}>: ${m.dbLevel} → **${m.calculatedLevel}** (${m.diff >= 0 ? '+' : ''}${m.diff}) | ${m.xp} XP`
            ).join('\n');

            embed.addFields({ 
                name: `${preview ? 'Would Update' : 'Updated'} (Top 10 by difference)`, 
                value: mismatchText || 'None', 
                inline: false 
            });

            if (mismatches.length > 10) {
                embed.addFields({
                    name: 'Note',
                    value: `+ ${mismatches.length - 10} more users ${preview ? 'would be' : 'were'} updated`,
                    inline: false
                });
            }
        }

        if (preview) {
            embed.addFields({
                name: '⚠️ Preview Mode',
                value: 'Run `/sync-levels preview:false` to apply these changes.',
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });
    }
}).toJSON();
