const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const db = require('../../utils/EconomyDB');
const { calculateLevel } = require('../../utils/LevelSystem');

module.exports = new ApplicationCommand({
    command: {
        name: 'add-stat-points',
        description: '[ADMIN] Add SPECIAL points to a user.',
        options: [
            {
                name: 'user',
                description: 'The user to give SPECIAL points to',
                type: ApplicationCommandOptionType.User,
                required: true
            },
            {
                name: 'amount',
                description: 'Number of SPECIAL points to add',
                type: ApplicationCommandOptionType.Integer,
                required: true,
                min_value: 1,
                max_value: 100
            }
        ]
    },
    defer: 'ephemeral',
    developer: true, // Requires bot developer permission
    run: async (client, interaction) => {
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        // Prevent adding points to bots
        if (targetUser.bot) {
            return interaction.editReply({ 
                content: '❌ Cannot add SPECIAL points to bots.' 
            });
        }

        // Get current user data
        const userData = await new Promise((resolve) => {
            db.get('SELECT stat_points, level, xp FROM users WHERE id = ?', [targetUser.id], (err, row) => {
                if (row) {
                    resolve(row);
                } else {
                    // If user doesn't exist, return defaults
                    resolve({ stat_points: 5, level: 1, xp: 0 });
                }
            });
        });

        // Calculate actual level from XP (in case DB level is outdated)
        const actualLevel = calculateLevel(userData.xp);

        // Add SPECIAL points
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET stat_points = stat_points + ? WHERE id = ?',
                [amount, targetUser.id],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        }).catch(err => {
            console.error('[ADD-STAT-POINTS] Database error:', err);
            return interaction.editReply({ content: '❌ Database error occurred.' });
        });

        const newTotal = userData.stat_points + amount;

        const embed = new EmbedBuilder()
            .setTitle('✅ SPECIAL Points Added')
            .setDescription(`Successfully added **${amount} SPECIAL point${amount > 1 ? 's' : ''}** to ${targetUser.username}`)
            .addFields(
                { name: 'Target User', value: `${targetUser.tag} (${targetUser.id})`, inline: false },
                { name: 'Points Added', value: `+${amount}`, inline: true },
                { name: 'Previous Total', value: `${userData.stat_points}`, inline: true },
                { name: 'New Total', value: `${newTotal}`, inline: true },
                { name: 'Current Level', value: `${actualLevel}`, inline: true },
                { name: 'Current XP', value: `${userData.xp}`, inline: true }
            )
            .setColor('#00ff00')
            .setFooter({ text: `Executed by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Notify the target user they received perk points
        try {
            const userEmbed = new EmbedBuilder()
                .setTitle('🎉 Perk Points Received!')
                .setDescription(`You received **${amount} perk point${amount > 1 ? 's' : ''}**!`)
                .addFields(
                    { name: 'Perk Points Added', value: `+${amount}`, inline: true },
                    { name: 'New Total', value: `${newTotal}`, inline: true },
                    { name: 'Level', value: `${actualLevel}`, inline: true }
                )
                .setColor('#FFD700')
                .setTimestamp();

            await targetUser.send({ embeds: [userEmbed] });
        } catch (dmError) {
            console.log(`Could not DM ${targetUser.tag} about perk points:`, dmError.message);
        }
    }
}).toJSON();
