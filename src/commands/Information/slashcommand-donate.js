const { EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const DonorSystem = require('../../utils/DonorSystem');
const config = require('../../config');

// Render a 12-segment text progress bar.
function progressBar(current, target) {
    const ratio = target > 0 ? Math.min(1, current / target) : 0;
    const filled = Math.round(ratio * 12);
    return `${'█'.repeat(filled)}${'░'.repeat(12 - filled)} ${Math.round(ratio * 100)}%`;
}

module.exports = new ApplicationCommand({
    command: {
        name: 'donate',
        description: 'Support the server and see what supporters unlock.'
    },
    run: async (client, interaction) => {
        const c = config.donor || {};
        const weekend = DonorSystem.isBonusWeekend();

        const tierLine = (key) => {
            const t = DonorSystem.TIERS[key];
            const p = DonorSystem.PERKS[key];
            return `${t.badge} **${t.name}** — ${t.xp_multiplier}x XP • ${p.daily_caps} daily caps • ` +
                `${p.gambling_max_bet_mult}x bet cap • +${p.luck_bonus} LUCK • in-game ${t.badge} tag`;
        };

        const embed = new EmbedBuilder()
            .setTitle('💖 Support the Wasteland')
            .setColor('#f1c40f')
            .setDescription(
                'Donations keep the servers running. Supporters unlock perks across **Discord and in-game**:\n\n' +
                `${tierLine('bronze')}\n${tierLine('silver')}\n${tierLine('gold')}\n${tierLine('platinum')}`
            )
            .addFields(
                { name: '🎁 First-time bonus', value: `New supporters get a one-time **${(c.first_donation_bonus_caps ?? 0).toLocaleString()} Caps** welcome gift.`, inline: false },
                { name: '🤝 Refer a friend', value: `Invite players and both of you earn caps — use \`/refer @them\`.`, inline: false }
            );

        if (c.goal_target > 0) {
            embed.addFields({
                name: `🎯 ${c.goal_label || 'Donation Goal'}`,
                value: `${progressBar(c.goal_current || 0, c.goal_target)}\n${(c.goal_current || 0).toLocaleString()} / ${c.goal_target.toLocaleString()}`,
                inline: false
            });
        }

        if (weekend) {
            embed.addFields({ name: '🔥 Weekend Bonus', value: 'Supporter caps perks are **doubled** all weekend!', inline: false });
        }

        if (c.donate_url) {
            embed.addFields({ name: '➡️ Donate here', value: c.donate_url, inline: false });
        }
        embed.setFooter({ text: 'Check your perks any time with /supporter-perks' });

        return interaction.reply({ embeds: [embed] });
    }
}).toJSON();
