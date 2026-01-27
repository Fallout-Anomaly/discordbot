const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const DonorSystem = require('../../utils/DonorSystem');
const config = require('../../config');

module.exports = new ApplicationCommand({
    command: {
        name: 'raffle-entries',
        description: 'Check your raffle entries for this month',
        options: [{
            name: 'user',
            description: 'Check a specific user (staff only)',
            type: ApplicationCommandOptionType.User
        }]
    },
    run: async (client, interaction) => {
        const staffRoleId = config.roles?.staff_role || process.env.STAFF_ROLE_ID;
        const isStaff = interaction.member.roles.cache.has(staffRoleId);
        const targetUser = interaction.options.getUser('user');
        
        if (targetUser && !isStaff) {
            return interaction.reply({ content: '❌ Only staff can check other users\' raffle entries.', flags: 64 });
        }

        const userId = targetUser ? targetUser.id : interaction.user.id;
        const donor = await DonorSystem.getDonor(userId);

        if (!donor) {
            return interaction.reply({
                content: `${targetUser ? targetUser.username : 'You'} ${targetUser ? 'is' : 'are'} not a supporter. Become one to enter the raffle!`,
                flags: 64
            });
        }

        const entries = await DonorSystem.getRaffleEntries(userId);
        const tierInfo = DonorSystem.TIERS[donor.tier];
        const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const embed = new EmbedBuilder()
            .setTitle('🎰 Raffle Entries')
            .setDescription(`**${tierInfo.name}** raffle status`)
            .addFields(
                { name: 'Current Entries', value: `**${entries}** entries for ${currentMonth}`, inline: true },
                { name: 'Maximum/Month', value: `**${tierInfo.raffle_entries_per_month}** entries`, inline: true },
                { name: 'Win Chance', value: entries > 0 ? `~${(entries / 100 * 100).toFixed(1)}%*` : 'No entries yet' }
            )
            .setColor(tierInfo.color)
            .setFooter({ text: '*Approximate based on typical participant count' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
}).toJSON();
