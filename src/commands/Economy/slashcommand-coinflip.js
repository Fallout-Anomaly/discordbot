const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const Gambling = require('../../utils/Gambling');
const DonorSystem = require('../../utils/DonorSystem');
const { error } = require('../../utils/Console');

const COINFLIP_COOLDOWN = 10 * 60 * 1000; // 10 minutes (base; supporters get a discount)
const MIN_BET = 1;
const MAX_BET = 50000;        // base cap for non-supporters
const MAX_BET_CEILING = 500000; // highest supporter cap (platinum 10x); enforced per-tier in code

// House keeps an edge: base 35% win, +1% per point of LUCK (max ~45% at 10 LUCK).
const BASE_WIN_CHANCE = 0.35;
const LUCK_BONUS = 0.01;

module.exports = new ApplicationCommand({
    command: {
        name: 'coinflip',
        description: 'Double or nothing! Bet your caps on a coin flip.',
        options: [
            {
                name: 'amount',
                description: `Amount of Caps to bet (${MIN_BET}+; supporters bet more)`,
                type: ApplicationCommandOptionType.Integer,
                required: true,
                minValue: MIN_BET,
                maxValue: MAX_BET_CEILING
            },
            {
                name: 'call',
                description: 'Call the coin (optional — random if omitted)',
                type: ApplicationCommandOptionType.String,
                required: false,
                choices: [
                    { name: 'Heads', value: 'heads' },
                    { name: 'Tails', value: 'tails' }
                ]
            }
        ]
    },
    defer: { flags: 64 },
    run: async (client, interaction) => {
        const userId = interaction.user.id;
        const amount = interaction.options.getInteger('amount');
        const call = interaction.options.getString('call') || (Math.random() < 0.5 ? 'heads' : 'tails');

        try {
            // Supporter perks: higher max bet, reduced cooldown, bonus LUCK.
            const perks = await DonorSystem.getPerks(userId, interaction.member);
            const userMaxBet = MAX_BET * perks.gambling_max_bet_mult;

            if (amount < MIN_BET || amount > userMaxBet) {
                const hint = perks.isSupporter ? '' : ' Supporters can bet far more — see `/donate`.';
                return interaction.editReply({ content: `❌ Your max bet is **${userMaxBet.toLocaleString()}** Caps (min ${MIN_BET}).${hint}` });
            }

            // Cooldown (persisted in DB so it survives restarts)
            const remaining = await Gambling.getCooldownRemaining(userId, 'coinflip');
            if (remaining > 0) {
                return interaction.editReply({
                    content: `⏱️ You need to wait **${Gambling.formatDuration(remaining)}** before gambling again!`
                });
            }

            // Atomic bet — fails if the player can't cover it.
            const couldBet = await Gambling.placeBet(userId, amount);
            if (!couldBet) {
                const balance = await Gambling.getBalance(userId);
                return interaction.editReply({ content: `❌ You're broke! You only have **${balance.toLocaleString()}** Caps.` });
            }

            // Lock the cooldown only after a successful bet (supporters wait less).
            await Gambling.setCooldown(userId, 'coinflip', Math.floor(COINFLIP_COOLDOWN * perks.gambling_cooldown_mult));

            const luck = await Gambling.getLuck(userId) + perks.luck_bonus;
            // Cap below 50% so the house always keeps an edge, even at max LUCK.
            const winChance = Math.min(0.49, BASE_WIN_CHANCE + luck * LUCK_BONUS);
            const won = Math.random() < winChance;

            // The coin lands on the called side when you win, the other side when you lose.
            const landed = won ? call : (call === 'heads' ? 'tails' : 'heads');
            const coinEmoji = landed === 'heads' ? '🪙' : '⚫';

            const payout = won ? amount * 2 : 0;
            if (payout > 0) await Gambling.credit(userId, payout);
            await Gambling.recordResult(userId, { wager: amount, payout });

            const balance = await Gambling.getBalance(userId);
            const net = payout - amount;

            const embed = new EmbedBuilder()
                .setTitle(`${coinEmoji} Coin Flip — ${landed.toUpperCase()}`)
                .setColor(won ? '#2ecc71' : '#e74c3c')
                .setDescription(
                    won
                        ? `You called **${call}** and **WON**! 🎉`
                        : `You called **${call}** — it landed **${landed}**. You lost. 💀`
                )
                .addFields(
                    { name: 'Bet', value: `${amount.toLocaleString()} Caps`, inline: true },
                    { name: won ? 'Net Win' : 'Net Loss', value: `${net >= 0 ? '+' : ''}${net.toLocaleString()} Caps`, inline: true },
                    { name: '💰 Balance', value: `${balance.toLocaleString()} Caps`, inline: true }
                )
                .setFooter({ text: `Win chance: ${Math.round(winChance * 100)}% (${luck} LUCK)` });

            return interaction.editReply({ embeds: [embed] });
        } catch (err) {
            error('[COINFLIP] Error:', err);
            return interaction.editReply({ content: '❌ The coin rolled under the table (database error).' });
        }
    }
}).toJSON();
