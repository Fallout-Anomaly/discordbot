const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const DonorSystem = require('../../utils/DonorSystem');

module.exports = new ApplicationCommand({
    command: {
        name: 'supporter-perks',
        description: 'View supporter tier benefits',
        options: [{
            name: 'user',
            description: 'Check a user\'s perks (optional)',
            type: ApplicationCommandOptionType.User
        }]
    },
    run: async (client, interaction) => {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        // Resolve the member so role-based supporters are recognised too.
        const member = interaction.guild
            ? await interaction.guild.members.fetch(targetUser.id).catch(() => null)
            : null;

        const tier = await DonorSystem.getEffectiveTier(targetUser.id, member);
        const donor = await DonorSystem.getDonor(targetUser.id);
        const referrals = await DonorSystem.getReferralCount(targetUser.id);
        const weekend = DonorSystem.isBonusWeekend();

        // Compact per-tier perk summary used in the teaser.
        const tierLine = (key) => {
            const t = DonorSystem.TIERS[key];
            const p = DonorSystem.PERKS[key];
            return `${t.badge} **${t.name}**\n` +
                `• ${t.xp_multiplier}x XP • ${p.daily_caps} daily caps\n` +
                `• ${p.gambling_max_bet_mult}x bet cap • +${p.luck_bonus} LUCK\n` +
                `• ${t.raffle_entries_per_month} raffle entries • in-game ${t.badge} tag`;
        };

        if (tier === 'none') {
            const embed = new EmbedBuilder()
                .setTitle('💎 Supporter Tiers')
                .setDescription(`${targetUser.username} is not currently a supporter.\n\nBecome a supporter to unlock exclusive perks across Discord **and** in-game!`)
                .addFields(
                    { name: '​', value: tierLine('bronze'), inline: true },
                    { name: '​', value: tierLine('silver'), inline: true },
                    { name: '​', value: tierLine('gold'), inline: true },
                    { name: '​', value: tierLine('platinum'), inline: true },
                    { name: 'Every tier also gets', value: '✨ Supporter role & leaderboard spot\n🎰 Reduced gamble cooldowns\n🏦 Boosted stash interest\n⚔️ Faster RPG cooldowns & faction rep' }
                )
                .setColor('#f39c12')
                .setFooter({ text: 'Use /donate to support the server!' })
                .setTimestamp();
            if (weekend) embed.addFields({ name: '🔥 Weekend Bonus Active', value: 'Supporter caps perks are **doubled** right now!' });
            return interaction.reply({ embeds: [embed] });
        }

        const tierInfo = DonorSystem.TIERS[tier];
        const perks = DonorSystem.PERKS[tier];
        const joinedDate = donor?.joined_date ? new Date(donor.joined_date).toLocaleDateString() : 'via role';

        const embed = new EmbedBuilder()
            .setTitle(`${tierInfo.badge} Supporter Status`)
            .setDescription(`${targetUser.username} is a **${tierInfo.name}**`)
            .addFields(
                {
                    name: '💰 Economy', value:
                        `• XP/caps multiplier: **${tierInfo.xp_multiplier}x**\n` +
                        `• Daily: **${perks.daily_caps}** • Weekly: **${perks.weekly_caps}** caps\n` +
                        `• Stash interest: **+${(perks.stash_interest_bonus * 100).toFixed(1)}%**`,
                    inline: true
                },
                {
                    name: '🎰 Casino & RPG', value:
                        `• Max bet: **${perks.gambling_max_bet_mult}x**\n` +
                        `• Gamble cooldown: **-${Math.round((1 - perks.gambling_cooldown_mult) * 100)}%**\n` +
                        `• +**${perks.luck_bonus}** LUCK • RPG cooldown **-${Math.round(perks.cooldown_reduction * 100)}%**\n` +
                        `• Faction rep: **${perks.faction_rep_mult}x** • +${perks.extra_daily_quests} daily quests`,
                    inline: true
                },
                {
                    name: '🌟 Status', value:
                        `• In-game **${tierInfo.badge}** name tag\n` +
                        `• ${tierInfo.raffle_entries_per_month} raffle entries/month\n` +
                        `• Referrals made: **${referrals}**\n` +
                        `• Supporter since: ${joinedDate}`,
                    inline: false
                }
            )
            .setColor(tierInfo.color)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setTimestamp();
        if (weekend) embed.setFooter({ text: '🔥 Weekend bonus active — caps perks doubled!' });

        return interaction.reply({ embeds: [embed] });
    }
}).toJSON();
