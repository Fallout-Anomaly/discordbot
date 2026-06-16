const db = require('../../utils/EconomyDB');
const DonorSystem = require('../../utils/DonorSystem');
const ApplicationCommand = require('../../structure/ApplicationCommand');

const COOLDOWN = 7 * 24 * 60 * 60 * 1000; // 7 days

module.exports = new ApplicationCommand({
    command: {
        name: 'weekly',
        description: 'Collect your weekly caps stipend (bigger for supporters).'
    },
    run: async (client, interaction) => {
        const userId = interaction.user.id;

        const perks = await DonorSystem.getPerks(userId, interaction.member);
        const reward = perks.weekly_caps;
        const tierInfo = perks.isSupporter ? DonorSystem.TIERS[perks.tier] : null;
        const bonusText = tierInfo ? ` ${tierInfo.badge} (${tierInfo.name})` : '';
        const weekendNote = (DonorSystem.isBonusWeekend() && perks.isSupporter) ? ' 🔥 Weekend x2!' : '';

        const now = Date.now();
        const cooldownCheck = now - COOLDOWN;

        // Atomic claim: only credit if no claim yet or the cooldown has elapsed.
        db.run(
            `INSERT INTO users (id, balance, weekly_last_claim) VALUES (?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                balance = IFNULL(balance, 0) + ?,
                weekly_last_claim = ?
             WHERE weekly_last_claim IS NULL OR weekly_last_claim < ?`,
            [userId, reward, now, reward, now, cooldownCheck],
            function (err) {
                if (err) {
                    console.error('[WEEKLY] Database error:', err.message);
                    return interaction.reply({ content: '❌ Database error.', flags: 64 });
                }

                if (this.changes === 0) {
                    db.get('SELECT weekly_last_claim FROM users WHERE id = ?', [userId], (e, row) => {
                        if (!row || !row.weekly_last_claim) {
                            return interaction.reply({ content: '⏳ An error occurred. Try again shortly.', flags: 64 });
                        }
                        const remaining = COOLDOWN - (now - row.weekly_last_claim);
                        const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
                        const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                        return interaction.reply({
                            content: `⏳ Your weekly stipend isn't ready yet. Come back in **${days}d ${hours}h**.`,
                            flags: 64
                        });
                    });
                    return;
                }

                return interaction.reply({
                    content: `📦 Weekly stipend collected! Received **${reward.toLocaleString()} Caps**${bonusText}${weekendNote}.`
                });
            }
        );
    }
}).toJSON();
