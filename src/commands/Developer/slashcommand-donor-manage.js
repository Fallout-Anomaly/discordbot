const { ApplicationCommandOptionType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const DonorSystem = require('../../utils/DonorSystem');
const config = require('../../config');

module.exports = new ApplicationCommand({
    command: {
        name: 'donor-manage',
        description: 'Admin: Manage donor/supporter status',
        defaultMemberPermissions: PermissionFlagsBits.Administrator.toString(),
        options: [
            {
                name: 'add',
                description: 'Add a donor',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    { name: 'user', description: 'User to add', type: ApplicationCommandOptionType.User, required: true },
                    { name: 'tier', description: 'Donor tier', type: ApplicationCommandOptionType.String, required: true,
                        choices: [
                            { name: 'Bronze (1.15x XP)', value: 'bronze' },
                            { name: 'Silver (1.3x XP)', value: 'silver' },
                            { name: 'Gold (1.5x XP)', value: 'gold' },
                            { name: 'Platinum (2.0x XP)', value: 'platinum' }
                        ]
                    },
                    { name: 'badge', description: 'Custom badge (optional)', type: ApplicationCommandOptionType.String }
                ]
            },
            { name: 'remove', description: 'Remove a donor', type: ApplicationCommandOptionType.Subcommand,
                options: [{ name: 'user', description: 'User to remove', type: ApplicationCommandOptionType.User, required: true }]
            },
            { name: 'list', description: 'List all donors', type: ApplicationCommandOptionType.Subcommand }
        ]
    },
    options: { botOwner: true },
    run: async (client, interaction) => {
        const staffRoleId = config.roles?.staff_role || process.env.STAFF_ROLE_ID;
        if (!interaction.member.roles.cache.has(staffRoleId)) {
            return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
        }
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'add') {
            const user = interaction.options.getUser('user');
            const tier = interaction.options.getString('tier');
            const badge = interaction.options.getString('badge') || '';
            await DonorSystem.addDonor(user.id, tier, badge);
            const tierInfo = DonorSystem.TIERS[tier];
            const embed = new EmbedBuilder()
                .setTitle('✅ Donor Added')
                .setDescription(`${user} has been added as a ${tierInfo.name}`)
                .addFields(
                    { name: 'Badge', value: badge || tierInfo.badge, inline: true },
                    { name: 'XP Multiplier', value: `${tierInfo.xp_multiplier}x`, inline: true },
                    { name: 'Raffle Entries/Month', value: `${tierInfo.raffle_entries_per_month}`, inline: true }
                )
                .setColor(tierInfo.color).setTimestamp();
            return interaction.reply({ embeds: [embed] });
        }
        if (subcommand === 'remove') {
            const user = interaction.options.getUser('user');
            await DonorSystem.removeDonor(user.id);
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('✅ Donor Removed').setDescription(`${user} is no longer a donor.`).setColor('#e74c3c')] });
        }
        if (subcommand === 'list') {
            const donors = await DonorSystem.getTopDonors(50);
            if (donors.length === 0) return interaction.reply({ content: 'No donors registered yet.', ephemeral: true });
            let desc = '';
            for (const donor of donors) {
                const tierInfo = DonorSystem.TIERS[donor.tier];
                const joinedDate = new Date(donor.joined_date).toLocaleDateString();
                desc += `${tierInfo.badge} <@${donor.user_id}> - **${tierInfo.name}** (joined ${joinedDate})\n`;
            }
            const embed = new EmbedBuilder().setTitle('💎 Donor List').setDescription(desc).setColor('#f39c12').setFooter({ text: `Total donors: ${donors.length}` }).setTimestamp();
            return interaction.reply({ embeds: [embed] });
        }
    }
}).toJSON();