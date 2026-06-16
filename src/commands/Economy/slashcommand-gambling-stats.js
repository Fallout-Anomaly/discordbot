const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const Gambling = require('../../utils/Gambling');
const { error } = require('../../utils/Console');

module.exports = new ApplicationCommand({
    command: {
        name: 'gambling-stats',
        description: 'View casino lifetime stats and the current progressive jackpot.',
        options: [
            {
                name: 'user',
                description: 'Whose stats to view (defaults to you)',
                type: ApplicationCommandOptionType.User,
                required: false
            }
        ]
    },
    defer: { flags: 64 },
    run: async (client, interaction) => {
        const target = interaction.options.getUser('user') || interaction.user;

        try {
            const [stats, jackpot] = await Promise.all([
                Gambling.getStats(target.id),
                Gambling.getJackpot()
            ]);

            const net = stats.total_won - stats.total_lost;
            const winRateNote = stats.games_played > 0
                ? `${stats.total_wagered.toLocaleString()} Caps wagered across ${stats.games_played.toLocaleString()} games`
                : 'No games played yet — try `/slots` or `/coinflip`!';

            const embed = new EmbedBuilder()
                .setTitle(`🎲 Casino Record — ${target.username}`)
                .setColor(net >= 0 ? '#2ecc71' : '#e74c3c')
                .setThumbnail(target.displayAvatarURL())
                .setDescription(winRateNote)
                .addFields(
                    { name: '🎮 Games Played', value: stats.games_played.toLocaleString(), inline: true },
                    { name: '💵 Total Won', value: `${stats.total_won.toLocaleString()} Caps`, inline: true },
                    { name: '💸 Total Lost', value: `${stats.total_lost.toLocaleString()} Caps`, inline: true },
                    { name: net >= 0 ? '📈 Net Profit' : '📉 Net Loss', value: `${net >= 0 ? '+' : ''}${net.toLocaleString()} Caps`, inline: true },
                    { name: '🏅 Biggest Win', value: `${stats.biggest_win.toLocaleString()} Caps`, inline: true },
                    { name: '🎰 Jackpots Hit', value: stats.jackpots.toLocaleString(), inline: true }
                )
                .setFooter({ text: `🎯 Current jackpot pool: ${jackpot.toLocaleString()} Caps — hit 7-7-7 on /slots to win it!` });

            return interaction.editReply({ embeds: [embed] });
        } catch (err) {
            error('[GAMBLING-STATS] Error:', err);
            return interaction.editReply({ content: '❌ Could not load gambling stats (database error).' });
        }
    }
}).toJSON();
