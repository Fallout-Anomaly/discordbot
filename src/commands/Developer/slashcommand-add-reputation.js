const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const FactionManager = require('../../utils/FactionManager');

module.exports = new ApplicationCommand({
    command: {
        name: 'add-reputation',
        description: '[ADMIN] Add faction reputation to a user.',
        options: [
            {
                name: 'user',
                description: 'The user to give reputation to',
                type: ApplicationCommandOptionType.User,
                required: true
            },
            {
                name: 'faction',
                description: 'The faction to add reputation for',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { name: '⚔️ Brotherhood of Steel', value: 'brotherhood' },
                    { name: '🤖 Institute', value: 'institute' },
                    { name: '🇺🇸 Minutemen', value: 'minutemen' },
                    { name: '🚆 Railroad', value: 'railroad' },
                    { name: '💀 Raiders', value: 'raiders' },
                    { name: '🏜️ Wastelanders', value: 'wastelanders' },
                    { name: '🏴 Smugglers', value: 'smugglers' },
                    { name: '🔫 Mercenaries', value: 'mercenaries' },
                    { name: '💼 Syndicate', value: 'syndicate' }
                ]
            },
            {
                name: 'amount',
                description: 'Amount of reputation to add (can be negative)',
                type: ApplicationCommandOptionType.Integer,
                required: true,
                min_value: -100,
                max_value: 100
            }
        ]
    },
    defer: 'ephemeral',
    developer: true, // Requires bot developer permission
    run: async (client, interaction) => {
        const targetUser = interaction.options.getUser('user');
        const factionId = interaction.options.getString('faction');
        const amount = interaction.options.getInteger('amount');

        // Prevent modifying bots
        if (targetUser.bot) {
            return interaction.editReply({ 
                content: '❌ Cannot modify faction reputation for bots.' 
            });
        }

        // Initialize player factions if needed
        await FactionManager.initializePlayerFactions(targetUser.id);

        // Get current faction stats
        const stats = await FactionManager.getPlayerFactionStats(targetUser.id);
        const currentRep = stats[factionId]?.reputation || 0;
        const currentRank = stats[factionId]?.rank || 'Outsider';

        // Modify reputation (bypassing daily limits by using 'admin' source)
        const result = await FactionManager.modifyReputation(targetUser.id, factionId, amount, 'admin');

        if (!result.success) {
            return interaction.editReply({ 
                content: `❌ Failed to modify reputation: ${result.reason}` 
            });
        }

        const newRep = result.reputation;
        const newRank = result.rank;
        const rankChanged = currentRank !== newRank;

        const embed = new EmbedBuilder()
            .setTitle('✅ Faction Reputation Modified')
            .setDescription(`Successfully modified **${factionId}** reputation for ${targetUser.username}`)
            .addFields(
                { name: 'Target User', value: `${targetUser.tag} (${targetUser.id})`, inline: false },
                { name: 'Faction', value: factionId.charAt(0).toUpperCase() + factionId.slice(1), inline: true },
                { name: 'Amount', value: `${amount >= 0 ? '+' : ''}${amount}`, inline: true },
                { name: 'Previous Rep', value: `${currentRep} (${currentRank})`, inline: true },
                { name: 'New Rep', value: `${newRep} (${newRank})`, inline: true }
            )
            .setColor(amount >= 0 ? '#00ff00' : '#ff0000')
            .setFooter({ text: `Executed by ${interaction.user.tag}` })
            .setTimestamp();

        if (rankChanged) {
            embed.addFields({ 
                name: '⭐ Rank Changed!', 
                value: `**${currentRank}** → **${newRank}**`, 
                inline: false 
            });
        }

        await interaction.editReply({ embeds: [embed] });

        // Notify the target user
        try {
            const userEmbed = new EmbedBuilder()
                .setTitle('📊 Faction Reputation Updated!')
                .setDescription(`Your **${factionId}** reputation has been modified by an administrator.`)
                .addFields(
                    { name: 'Change', value: `${amount >= 0 ? '+' : ''}${amount} reputation`, inline: true },
                    { name: 'New Total', value: `${newRep}`, inline: true },
                    { name: 'Rank', value: newRank, inline: true }
                )
                .setColor(amount >= 0 ? '#FFD700' : '#E74C3C')
                .setTimestamp();

            if (rankChanged) {
                userEmbed.addFields({ 
                    name: '⭐ Rank Promotion!', 
                    value: `You are now **${newRank}** rank!`, 
                    inline: false 
                });
            }

            await targetUser.send({ embeds: [userEmbed] });
        } catch (dmError) {
            console.log(`Could not DM ${targetUser.tag} about reputation change:`, dmError.message);
        }
    }
}).toJSON();
