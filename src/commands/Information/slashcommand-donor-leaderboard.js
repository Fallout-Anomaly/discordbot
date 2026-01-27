const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Command = require('../../structure/MessageCommand');
const DonorSystem = require('../../utils/DonorSystem');

module.exports = new Command({
    data: new SlashCommandBuilder()
        .setName('donor-leaderboard')
        .setDescription('View the supporter leaderboard')
        .addIntegerOption(opt => opt
            .setName('page')
            .setDescription('Page number (default: 1)')
            .setMinValue(1)
            .setMaxValue(10)
        ),
    
    async run(interaction) {
        const page = interaction.options.getInteger('page') || 1;
        const perPage = 10;
        const offset = (page - 1) * perPage;

        const donors = await DonorSystem.getTopDonors(100);
        const totalPages = Math.ceil(donors.length / perPage);
        const pageDonors = donors.slice(offset, offset + perPage);

        if (donors.length === 0) {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('💎 Supporter Leaderboard')
                    .setDescription('No supporters yet. Be the first!')
                    .setColor('#f39c12')
                ]
            });
        }

        let desc = '';
        let rank = offset + 1;

        for (const donor of pageDonors) {
            const tierInfo = DonorSystem.TIERS[donor.tier];
            const joinedDate = new Date(donor.joined_date).toLocaleDateString();
            desc += `**#${rank}** ${tierInfo.badge} <@${donor.user_id}>\n`;
            desc += `└ ${tierInfo.name} • Joined ${joinedDate}\n\n`;
            rank++;
        }

        const embed = new EmbedBuilder()
            .setTitle('💎 Supporter Leaderboard')
            .setDescription(desc || 'No supporters on this page.')
            .setColor('#f39c12')
            .setFooter({ text: `Page ${page}/${totalPages} • Total supporters: ${donors.length}` })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
});
