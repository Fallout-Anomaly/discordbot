const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const Gambling = require('../../utils/Gambling');
const DonorSystem = require('../../utils/DonorSystem');
const { error } = require('../../utils/Console');

const MIN_BET = 10;
const MAX_BET = 100000;          // base cap for non-supporters
const MAX_BET_CEILING = 1000000; // highest supporter cap (platinum 10x); enforced per-tier in code

// Weighted reel. Rarer symbols pay more. Paytable tuned to ~86.5% RTP
// (~13.5% house edge) including the progressive jackpot. `three` = gross payout
// multiplier for three-of-a-kind, `two` = gross multiplier for a matching pair
// (0 = that symbol's pairs pay nothing).
const REELS = [
    { e: '🍒', w: 32, three: 5,  two: 2 },
    { e: '🍋', w: 24, three: 8,  two: 0 },
    { e: '🍇', w: 16, three: 14, two: 0 },
    { e: '🍉', w: 12, three: 18, two: 0 },
    { e: '🔔', w: 9,  three: 28, two: 0 },
    { e: '💎', w: 5,  three: 80, two: 4 },
    { e: '7️⃣', w: 2, three: 0,  two: 12 } // three 7s = jackpot (handled below)
];
const TOTAL_WEIGHT = REELS.reduce((sum, s) => sum + s.w, 0);

const JACKPOT_BASE = 125;     // 7-7-7 pays bet × this, PLUS the progressive pool
const JACKPOT_CONTRIB = 0.01; // 1% of every bet feeds the pool

function spinReel() {
    let roll = Math.random() * TOTAL_WEIGHT;
    for (const sym of REELS) {
        if ((roll -= sym.w) < 0) return sym;
    }
    return REELS[0];
}

// Returns { multiplier, isJackpot } for a spin.
function evaluate(a, b, c) {
    if (a.e === b.e && b.e === c.e) {
        if (a.e === '7️⃣') return { multiplier: JACKPOT_BASE, isJackpot: true };
        return { multiplier: a.three, isJackpot: false };
    }
    const reel = [a, b, c];
    let best = 0;
    for (const sym of reel) {
        if (reel.filter((x) => x.e === sym.e).length === 2) best = Math.max(best, sym.two);
    }
    return { multiplier: best, isJackpot: false };
}

module.exports = new ApplicationCommand({
    command: {
        name: 'slots',
        description: 'Spin the Lucky 38 reels — match symbols and chase the progressive jackpot!',
        options: [
            {
                name: 'amount',
                description: `Amount of Caps to bet (${MIN_BET}+; supporters bet more)`,
                type: ApplicationCommandOptionType.Integer,
                required: true,
                minValue: MIN_BET,
                maxValue: MAX_BET_CEILING
            }
        ]
    },
    defer: { flags: 64 },
    run: async (client, interaction) => {
        const userId = interaction.user.id;
        const amount = interaction.options.getInteger('amount');

        try {
            // Supporter perk: higher max bet (reels stay pure RNG to keep RTP fixed).
            const perks = await DonorSystem.getPerks(userId, interaction.member);
            const userMaxBet = MAX_BET * perks.gambling_max_bet_mult;
            if (amount < MIN_BET || amount > userMaxBet) {
                const hint = perks.isSupporter ? '' : ' Supporters can bet far more — see `/donate`.';
                return interaction.editReply({ content: `❌ Your max bet is **${userMaxBet.toLocaleString()}** Caps (min ${MIN_BET}).${hint}` });
            }

            const couldBet = await Gambling.placeBet(userId, amount);
            if (!couldBet) {
                const balance = await Gambling.getBalance(userId);
                return interaction.editReply({
                    content: `❌ You entered the casino with empty pockets. You have **${balance.toLocaleString()}** Caps.`
                });
            }

            // Feed the progressive pool, then spin.
            await Gambling.addToJackpot(amount * JACKPOT_CONTRIB);

            const r1 = spinReel(), r2 = spinReel(), r3 = spinReel();
            const { multiplier, isJackpot } = evaluate(r1, r2, r3);

            let payout = 0;
            let pool = 0;
            if (isJackpot) {
                pool = await Gambling.claimJackpot();
                payout = amount * multiplier + pool;
            } else {
                payout = Math.floor(amount * multiplier);
            }

            if (payout > 0) await Gambling.credit(userId, payout);
            await Gambling.recordResult(userId, { wager: amount, payout, jackpot: isJackpot });

            const balance = await Gambling.getBalance(userId);
            const net = payout - amount;

            const embed = new EmbedBuilder()
                .setTitle('🎰 LUCKY 38 SLOTS 🎰')
                .setDescription(`**[ ${r1.e} | ${r2.e} | ${r3.e} ]**`)
                .addFields(
                    { name: 'Bet', value: `${amount.toLocaleString()} Caps`, inline: true },
                    { name: 'Payout', value: `${multiplier ? `${multiplier}x` : '—'}`, inline: true },
                    {
                        name: net >= 0 ? 'Net' : 'Net Loss',
                        value: `${net >= 0 ? '+' : ''}${net.toLocaleString()} Caps`,
                        inline: true
                    },
                    { name: '💰 Balance', value: `${balance.toLocaleString()} Caps`, inline: true }
                );

            if (isJackpot) {
                embed.setColor('#f1c40f')
                    .setDescription(`**[ ${r1.e} | ${r2.e} | ${r3.e} ]**\n\n🎉 **JACKPOT!!!** 🎉`)
                    .addFields({ name: '🏆 Progressive Pool Won', value: `**${pool.toLocaleString()}** Caps`, inline: true })
                    .setFooter({ text: 'The legendary 777! The pool resets for the next lucky soul.' });
            } else {
                const jackpotNow = await Gambling.getJackpot();
                embed.setColor(payout > 0 ? '#2ecc71' : '#e74c3c')
                    .addFields({ name: '🎯 Jackpot Pool', value: `${jackpotNow.toLocaleString()} Caps`, inline: true })
                    .setFooter({ text: payout > 0 ? 'WINNER WINNER! Hit 7-7-7 for the jackpot.' : 'Better luck next time, courier.' });
            }

            return interaction.editReply({ embeds: [embed] });
        } catch (err) {
            error('[SLOTS] Error:', err);
            return interaction.editReply({ content: '❌ The slot machine jammed (database error). Your bet was not processed.' });
        }
    }
}).toJSON();
