const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const FactionManager = require('../../utils/FactionManager');

module.exports = new ApplicationCommand({
    command: {
        name: 'reset-faction',
        description: '[ADMIN] Reset a user\'s faction allegiance and reputation.',
        options: [
            {
                name: 'user',
                description: 'The user to reset',
                type: ApplicationCommandOptionType.User,
                required: true
            },
            {
                name: 'keep_reputation',
                description: 'Keep their reputation with all factions (default: false)',
                type: ApplicationCommandOptionType.Boolean,
                required: false
            }
        ]
    },
    defer: { flags: 64 },
    developer: true,
    run: async (client, interaction) => {
        const db = require('../../utils/EconomyDB');
        const targetUser = interaction.options.getUser('user');
        const keepRep = interaction.options.getBoolean('keep_reputation') || false;

        if (targetUser.bot) {
            return interaction.editReply({ 
                content: '❌ Cannot reset faction data for bots.' 
            });
        }

        // Get current allegiance
        const allegiance = await FactionManager.getPlayerAllegiance(targetUser.id);
        const stats = await FactionManager.getPlayerFactionStats(targetUser.id);

        if (!allegiance?.faction_id) {
            return interaction.editReply({ 
                content: '❌ User has no faction allegiance to reset.' 
            });
        }

        const oldFaction = allegiance.faction_id;
        const oldRank = stats[oldFaction]?.rank || 'Outsider';
        const oldRep = stats[oldFaction]?.reputation || 0;

        // Delete allegiance
        await new Promise((resolve) => {
            db.run('DELETE FROM player_allegiance WHERE user_id = ?', [targetUser.id], () => resolve());
        });

        // Clear hostilities
        await new Promise((resolve) => {
            db.run('DELETE FROM faction_hostility WHERE user_id = ?', [targetUser.id], () => resolve());
        });

        // Optionally reset reputation
        if (!keepRep) {
            await new Promise((resolve) => {
                db.run('DELETE FROM player_factions WHERE user_id = ?', [targetUser.id], () => {
                    // Re-initialize with 0 rep
                    FactionManager.initializePlayerFactions(targetUser.id).then(() => resolve());
                });
            });

            // Clear reputation log
            await new Promise((resolve) => {
                db.run('DELETE FROM faction_rep_log WHERE user_id = ?', [targetUser.id], () => resolve());
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('✅ Faction Reset Complete')
            .setDescription(`Successfully reset faction allegiance for ${targetUser.username}`)
            .addFields(
                { name: 'Target User', value: `${targetUser.tag} (${targetUser.id})`, inline: false },
                { name: 'Previous Faction', value: oldFaction.charAt(0).toUpperCase() + oldFaction.slice(1), inline: true },
                { name: 'Previous Rank', value: `${oldRank} (${oldRep} rep)`, inline: true },
                { name: 'Allegiance', value: '✅ Removed', inline: true },
                { name: 'Hostilities', value: '✅ Cleared', inline: true },
                { name: 'Reputation', value: keepRep ? '⚠️ Kept' : '✅ Reset to 0', inline: true }
            )
            .setColor('#FFA500')
            .setFooter({ text: `Executed by ${interaction.user.tag}` })
            .setTimestamp();

        if (keepRep) {
            embed.addFields({
                name: '💡 Note',
                value: 'Reputation was preserved. User can choose a new faction at Level 10+.',
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });

        // Notify the target user
        try {
            const userEmbed = new EmbedBuilder()
                .setTitle('⚠️ Faction Reset')
                .setDescription(`Your faction allegiance has been reset by an administrator.`)
                .addFields(
                    { name: 'Previous Faction', value: oldFaction.charAt(0).toUpperCase() + oldFaction.slice(1), inline: true },
                    { name: 'Previous Rank', value: `${oldRank}`, inline: true },
                    { name: 'Status', value: 'You can now choose a new faction at Level 10+', inline: false }
                )
                .setColor('#FFA500')
                .setTimestamp();

            if (keepRep) {
                userEmbed.addFields({
                    name: '💡 Good News',
                    value: 'Your reputation with all factions has been preserved!',
                    inline: false
                });
            } else {
                userEmbed.addFields({
                    name: '⚠️ Reputation Reset',
                    value: 'All faction reputation has been reset to 0 (Outsider).',
                    inline: false
                });
            }

            await targetUser.send({ embeds: [userEmbed] });
        } catch (dmError) {
            console.log(`Could not DM ${targetUser.tag} about faction reset:`, dmError.message);
        }
    }
}).toJSON();
