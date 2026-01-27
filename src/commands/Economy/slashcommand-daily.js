const db = require('../../utils/EconomyDB');
const ApplicationCommand = require("../../structure/ApplicationCommand");
const config = require('../../config');

module.exports = new ApplicationCommand({
    command: {
        name: 'daily',
        description: 'Collect your daily wasteland allowance.',
    },
    run: async (client, interaction) => {
        const userId = interaction.user.id;
        
        // Tiered Rewards Configuration
        let rewardCaps = 100;
        let bonusText = '';
        let extraItems = []; // Array of {id, amount, name}

        const donatorRole = config.users.donator_role;
        const boosterRole = config.users.booster_role;

        if (interaction.member.roles.cache.has(donatorRole)) {
            // Donator Tier (Highest)
            rewardCaps = 300;
            bonusText = ' 🌟 (Donator Bonus x3 + Supply Drop)';
            extraItems = [
                { id: 'stimpak', amount: 3, name: 'Stimpak' },
                { id: '10mm_rounds', amount: 50, name: '10mm Rounds' },
                { id: 'nuka_quantum', amount: 2, name: 'Nuka-Cola Quantum' },
                { id: 'fusion_core', amount: 1, name: 'Fusion Core' }
            ];
        } else if (interaction.member.roles.cache.has(boosterRole)) {
            // Booster Tier
            rewardCaps = 150;
            bonusText = ' 🚀 (Booster Bonus x1.5 + Mini-Drop)';
            extraItems = [
                { id: 'stimpak', amount: 1, name: 'Stimpak' },
                { id: '10mm_rounds', amount: 20, name: '10mm Rounds' },
                { id: 'nuka_cola', amount: 1, name: 'Nuka-Cola' }
            ];
        }

        db.get('SELECT daily_last_claim, balance FROM users WHERE id = ?', [userId], (err, row) => {
            if (err) return interaction.reply({ content: '❌ Database error.', ephemeral: true });

            const now = Date.now();
            const lastClaim = row ? row.daily_last_claim : 0;
            const cooldown = 24 * 60 * 60 * 1000; // 24 hours

            if (now - lastClaim < cooldown) {
                const remaining = cooldown - (now - lastClaim);
                const hours = Math.floor(remaining / (1000 * 60 * 60));
                const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                return interaction.reply({ 
                    content: `⏳ Easy there! Come back in **${hours}h ${minutes}m** to claim again.`, 
                    ephemeral: true 
                });
            }

            // Grant reward inside serialized block
            db.serialize(() => {
                // Update User Balance & Timer
                if (!row) {
                    db.run('INSERT INTO users (id, balance, daily_last_claim) VALUES (?, ?, ?)', [userId, rewardCaps, now]);
                } else {
                    db.run('UPDATE users SET balance = balance + ?, daily_last_claim = ? WHERE id = ?', [rewardCaps, now, userId]);
                }

                // Grant Extra Items
                let itemLog = [];
                extraItems.forEach(item => {
                    itemLog.push(`${item.amount}x ${item.name}`);
                    // Check if exists in inventory, update or insert
                    // We can use INSERT OR IGNORE then UPDATE, or just a simple UPSERT-like logic if we trust SQLite version.
                    // For safety in unknown sqlite versions, we just do a blind Insert-on-Duplicate logic or check first.
                    // Actually, let's use a simple heuristic: try UPDATE, if changes=0 then INSERT (but we can't easily check changes in db.run callback without nesting).
                    // We'll just run a UPSERT query if SQLite >= 3.24. Assuming new env.
                    // Fallback safe method:
                     db.run(`INSERT INTO inventory (user_id, item_id, amount) VALUES (?, ?, ?) 
                             ON CONFLICT(user_id, item_id) DO UPDATE SET amount = amount + ?`, 
                             [userId, item.id, item.amount, item.amount], (err) => {
                                 if (err) console.error("Item grant error:", err.message);
                             });
                });

                const itemMsg = itemLog.length > 0 ? `\n📦 **Supply Drop:** ${itemLog.join(', ')}` : '';
                interaction.reply({ content: `🎁 You found a stash! Received **${rewardCaps} Caps**${bonusText}!${itemMsg}` });
            });
        });
    }
}).toJSON();
