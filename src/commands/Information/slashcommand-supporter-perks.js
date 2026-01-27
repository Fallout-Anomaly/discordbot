const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Command = require('../../structure/MessageCommand');
const DonorSystem = require('../../utils/DonorSystem');

module.exports = new Command({
    data: new SlashCommandBuilder()
        .setName('supporter-perks')
        .setDescription('View supporter tier benefits')
        .addUserOption(opt => opt.setName('user').setDescription('Check a user\'s perks (optional)')),
    
    async run(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const donor = await DonorSystem.getDonor(targetUser.id);

        if (!donor) {
            const embed = new EmbedBuilder()
                .setTitle('💎 Supporter Tiers')
                .setDescription(`${targetUser.username} is not currently a supporter.\n\nBecome a supporter to unlock exclusive perks!`)
                .addFields(
                    {
                        name: '🥉 Bronze',
                        value: '• 1.15x XP multiplier\n• 2 raffle entries/month\n• Custom username badge',
                        inline: true
                    },
                    {
                        name: '🥈 Silver',
                        value: '• 1.3x XP multiplier\n• 5 raffle entries/month\n• Custom username badge',
                        inline: true
                    },
                    {
                        name: '🏅 Gold',
                        value: '• 1.5x XP multiplier\n• 10 raffle entries/month\n• Custom username badge',
                        inline: true
                    },
                    {
                        name: '💎 Platinum',
                        value: '• 2.0x XP multiplier\n• 25 raffle entries/month\n• Custom username badge',
                        inline: true
                    },
                    {
                        name: 'All Tiers Include:',
                        value: '✨ Exclusive supporter role\n📊 Featured on leaderboard\n🎰 Monthly raffle entries\n💰 Bonus economy rewards'
                    }
                )
                .setColor('#f39c12')
                .setFooter({ text: 'Support the server and unlock benefits!' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // User is a donor - show their current perks
        const tierInfo = DonorSystem.TIERS[donor.tier];
        const joinedDate = new Date(donor.joined_date).toLocaleDateString();

        const embed = new EmbedBuilder()
            .setTitle(`${tierInfo.badge} Supporter Status`)
            .setDescription(`${targetUser.username} is a **${tierInfo.name}**`)
            .addFields(
                {
                    name: 'Tier Benefits',
                    value: `• XP Multiplier: **${tierInfo.xp_multiplier}x**\n• Raffle Entries/Month: **${tierInfo.raffle_entries_per_month}**\n• Joined: ${joinedDate}`,
                    inline: false
                },
                {
                    name: 'Active Perks',
                    value: '✨ Exclusive supporter role\n📊 Leaderboard ranking\n🎰 Monthly raffle entries\n💰 Bonus caps rewards',
                    inline: false
                }
            )
            .setColor(tierInfo.color)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
});
