const db = require('../../utils/EconomyDB');
const DonorSystem = require('../../utils/DonorSystem');
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'daily',
        description: 'Collect your daily wasteland allowance.',
    },
    run: async (client, interaction) => {
        const userId = interaction.user.id;
        
        // Tier-based reward. getPerks() unifies the role-based and donor-table
        // systems and already folds in the weekend caps bonus.
        const perks = await DonorSystem.getPerks(userId, interaction.member);
        const donorBadge = await DonorSystem.getDonorBadge(userId);

        // Supply drops scale with tier.
        const DROPS = {
            none:     [],
            bronze:   [{ id: 'stimpak', amount: 1, name: 'Stimpak' }, { id: '10mm_rounds', amount: 20, name: '10mm Rounds' }],
            silver:   [{ id: 'stimpak', amount: 2, name: 'Stimpak' }, { id: '10mm_rounds', amount: 30, name: '10mm Rounds' }, { id: 'nuka_cola', amount: 1, name: 'Nuka-Cola' }],
            gold:     [{ id: 'stimpak', amount: 3, name: 'Stimpak' }, { id: '10mm_rounds', amount: 50, name: '10mm Rounds' }, { id: 'nuka_quantum', amount: 2, name: 'Nuka-Cola Quantum' }],
            platinum: [{ id: 'stimpak', amount: 5, name: 'Stimpak' }, { id: '10mm_rounds', amount: 75, name: '10mm Rounds' }, { id: 'nuka_quantum', amount: 3, name: 'Nuka-Cola Quantum' }, { id: 'fusion_core', amount: 1, name: 'Fusion Core' }]
        };
        const extraItems = DROPS[perks.tier] || [];
        const finalCaps = perks.daily_caps;
        const tierInfo = perks.isSupporter ? DonorSystem.TIERS[perks.tier] : null;
        const bonusText = tierInfo ? ` ${tierInfo.badge} (${tierInfo.name})` : '';
        const donorNote = perks.isSupporter && donorBadge ? ` ${donorBadge}` : '';
        const weekendNote = (DonorSystem.isBonusWeekend() && perks.isSupporter) ? ' 🔥 Weekend x2!' : '';

        const now = Date.now();
        const cooldown = 24 * 60 * 60 * 1000; // 24 hours
        const cooldownCheck = now - cooldown;

        // ATOMIC UPDATE: Ensure cooldown check and reward are done in a single operation
        // This prevents double-claiming where multiple requests could claim before cooldown updates
        db.run(
            `INSERT INTO users (id, balance, daily_last_claim) VALUES (?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET 
                balance = IFNULL(balance, 0) + ?,
                daily_last_claim = ?
             WHERE daily_last_claim IS NULL OR daily_last_claim < ?`,
            [userId, finalCaps, now, finalCaps, now, cooldownCheck],
            function (err) {
                if (err) {
                    console.error('[DAILY] Database error:', err.message);
                    return interaction.reply({ content: '❌ Database error.', flags: 64 });
                }

                // If no rows changed, user is on cooldown
                if (this.changes === 0) {
                    db.get('SELECT daily_last_claim FROM users WHERE id = ?', [userId], (err, row) => {
                        if (!row || !row.daily_last_claim) {
                            return interaction.reply({ content: '⏳ An error occurred. Try again shortly.', flags: 64 });
                        }

                        const remaining = cooldown - (now - row.daily_last_claim);
                        const hours = Math.floor(remaining / (1000 * 60 * 60));
                        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                        return interaction.reply({ 
                            content: `⏳ Easy there! Come back in **${hours}h ${minutes}m** to claim again.`, 
                            flags: 64 
                        });
                    });
                    return;
                }

                // Grant reward successful, now distribute extra items
                db.serialize(() => {
                    let itemLog = [];
                    extraItems.forEach(item => {
                        itemLog.push(`${item.amount}x ${item.name}`);
                        // UPSERT: Insert or update inventory
                        db.run(
                            `INSERT INTO inventory (user_id, item_id, amount) VALUES (?, ?, ?) 
                             ON CONFLICT(user_id, item_id) DO UPDATE SET amount = amount + ?`, 
                            [userId, item.id, item.amount, item.amount],
                            (err) => {
                                if (err) console.error('[DAILY] Item grant error:', err.message);
                            }
                        );
                    });

                    const itemMsg = itemLog.length > 0 ? `\n📦 **Supply Drop:** ${itemLog.join(', ')}` : '';
                    interaction.reply({ content: `🎁 You found a stash! Received **${finalCaps} Caps**${bonusText}${donorNote}${weekendNote}!${itemMsg}` });
                });
            }
        );
    }
}).toJSON();
