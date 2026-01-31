const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const { calculateLevel, calculateTotalXP } = require('../../utils/LevelSystem');
const { warn, error } = require('../../utils/Console');

module.exports = new ApplicationCommand({
    command: {
        name: 'add-level',
        description: '[ADMIN] Set or add levels to a user.',
        options: [
            {
                name: 'user',
                description: 'The user to modify',
                type: ApplicationCommandOptionType.User,
                required: true
            },
            {
                name: 'levels',
                description: 'Number of levels to add (use negative to remove)',
                type: ApplicationCommandOptionType.Integer,
                required: true,
                min_value: -100,
                max_value: 100
            },
            {
                name: 'mode',
                description: 'Add to current level or set exact level',
                type: ApplicationCommandOptionType.String,
                required: false,
                choices: [
                    { name: 'Add (default)', value: 'add' },
                    { name: 'Set exact level', value: 'set' }
                ]
            }
        ]
    },
    defer: { flags: 64 },
    developer: true,
    run: async (client, interaction) => {
        const db = require('../../utils/EconomyDB');
        const targetUser = interaction.options.getUser('user');
        const levels = interaction.options.getInteger('levels');
        const mode = interaction.options.getString('mode') || 'add';

        if (targetUser.bot) {
            return interaction.editReply({ 
                content: '❌ Cannot modify levels for bots.' 
            });
        }

        // Get current user data
        const userData = await new Promise((resolve) => {
            db.get('SELECT xp, level FROM users WHERE id = ?', [targetUser.id], (err, row) => {
                if (err) {
                    error('Database error:', err);
                    resolve(null);
                } else {
                    resolve(row);
                }
            });
        });

        if (!userData) {
            return interaction.editReply({ 
                content: '❌ User not found in database. They need to use a command first.' 
            });
        }

        const currentXP = userData.xp || 0;
        const currentLevel = calculateLevel(currentXP);
        let targetLevel;

        // Calculate target level
        if (mode === 'set') {
            targetLevel = Math.max(1, levels); // Can't set below level 1
        } else {
            targetLevel = Math.max(1, currentLevel + levels); // Can't go below level 1
        }

        // Calculate new XP for target level
        const newXP = calculateTotalXP(targetLevel);
        const levelsChanged = targetLevel - currentLevel;

        // Update database
        await new Promise((resolve) => {
            db.run(
                'UPDATE users SET xp = ? WHERE id = ?',
                [newXP, targetUser.id],
                (err) => {
                    if (err) error('Failed to update user level:', err);
                    resolve();
                }
            );
        });

        const embed = new EmbedBuilder()
            .setTitle('✅ Level Modified')
            .setDescription(`Successfully modified level for ${targetUser.username}`)
            .addFields(
                { name: 'Target User', value: `${targetUser.tag} (${targetUser.id})`, inline: false },
                { name: 'Mode', value: mode === 'set' ? 'Set Exact Level' : 'Add Levels', inline: true },
                { name: 'Input', value: mode === 'set' ? `${levels}` : `${levels >= 0 ? '+' : ''}${levels}`, inline: true },
                { name: 'Previous Level', value: `${currentLevel} (${currentXP} XP)`, inline: true },
                { name: 'New Level', value: `${targetLevel} (${newXP} XP)`, inline: true },
                { name: 'Change', value: `${levelsChanged >= 0 ? '+' : ''}${levelsChanged} levels`, inline: true }
            )
            .setColor(levelsChanged >= 0 ? '#00ff00' : '#ff9900')
            .setFooter({ text: `Executed by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Notify the target user
        try {
            const userEmbed = new EmbedBuilder()
                .setTitle('📊 Level Updated!')
                .setDescription(`Your level has been modified by an administrator.`)
                .addFields(
                    { name: 'Previous Level', value: `${currentLevel}`, inline: true },
                    { name: 'New Level', value: `${targetLevel}`, inline: true },
                    { name: 'Change', value: `${levelsChanged >= 0 ? '+' : ''}${levelsChanged}`, inline: true },
                    { name: 'New XP', value: `${newXP}`, inline: false }
                )
                .setColor('#FFD700')
                .setTimestamp();

            if (levelsChanged > 0) {
                userEmbed.addFields({ 
                    name: '💡 Reminder', 
                    value: `This level change does NOT grant SPECIAL points. Use your naturally earned perk points wisely!`, 
                    inline: false 
                });
            }

            await targetUser.send({ embeds: [userEmbed] });
        } catch (dmError) {
            warn(`Could not DM ${targetUser.tag} about level change:`, dmError.message);
        }
    }
}).toJSON();
