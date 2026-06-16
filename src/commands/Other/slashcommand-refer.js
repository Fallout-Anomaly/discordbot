const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const DonorSystem = require('../../utils/DonorSystem');
const config = require('../../config');
const { error } = require('../../utils/Console');

module.exports = new ApplicationCommand({
    command: {
        name: 'refer',
        description: 'Credit the survivor who invited you — you both earn caps!',
        options: [
            {
                name: 'user',
                description: 'The member who referred you',
                type: ApplicationCommandOptionType.User,
                required: true
            }
        ]
    },
    defer: { flags: 64 },
    run: async (client, interaction) => {
        const referrer = interaction.options.getUser('user');
        const referredId = interaction.user.id;
        const windowDays = config.donor?.referral_window_days ?? 14;

        try {
            if (!interaction.guild) {
                return interaction.editReply({ content: '❌ This command can only be used in the server.' });
            }
            if (referrer.bot) {
                return interaction.editReply({ content: '❌ You cannot be referred by a bot.' });
            }
            if (referrer.id === referredId) {
                return interaction.editReply({ content: '❌ You cannot refer yourself, smooth operator.' });
            }

            // Referrer must be a real member of this server.
            const referrerMember = await interaction.guild.members.fetch(referrer.id).catch(() => null);
            if (!referrerMember) {
                return interaction.editReply({ content: '❌ That user is not a member of this server.' });
            }

            // Must claim within the join window so this rewards *new* arrivals only.
            const joinedTs = interaction.member?.joinedTimestamp;
            if (joinedTs && Date.now() - joinedTs > windowDays * 86400000) {
                return interaction.editReply({
                    content: `❌ Referrals can only be claimed within **${windowDays} days** of joining. Your window has closed.`
                });
            }

            if (await DonorSystem.hasBeenReferred(referredId)) {
                return interaction.editReply({ content: '❌ You have already claimed a referral. Only one per survivor!' });
            }

            const reward = await DonorSystem.processReferral(referrer.id, referredId);

            const embed = new EmbedBuilder()
                .setTitle('🤝 Referral Claimed!')
                .setColor('#2ecc71')
                .setDescription(`You credited ${referrer} for inviting you to the Wasteland.`)
                .addFields(
                    { name: 'You received', value: `**${reward.referredCaps.toLocaleString()}** Caps`, inline: true },
                    { name: `${referrer.username} received`, value: `**${reward.referrerCaps.toLocaleString()}** Caps + ${reward.raffleEntries} raffle entr${reward.raffleEntries === 1 ? 'y' : 'ies'}`, inline: true }
                )
                .setFooter({ text: 'Thanks for growing the community!' });

            // Best-effort heads-up to the referrer.
            referrer.send(`🎉 **${interaction.user.username}** just credited you as their referrer in **${interaction.guild.name}**! You earned **${reward.referrerCaps.toLocaleString()}** Caps and ${reward.raffleEntries} raffle entr${reward.raffleEntries === 1 ? 'y' : 'ies'}.`).catch(() => {});

            return interaction.editReply({ embeds: [embed] });
        } catch (err) {
            error('[REFER] Error:', err);
            return interaction.editReply({ content: '❌ Could not process the referral (database error).' });
        }
    }
}).toJSON();
