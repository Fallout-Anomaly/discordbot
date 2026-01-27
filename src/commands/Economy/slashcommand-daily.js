const db = require('../../utils/EconomyDB');
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'daily',
        description: 'Collect your daily wasteland allowance.',
    },
    run: async (client, interaction) => {
        const userId = interaction.user.id;
        const reward = 100; // Daily reward amount

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
                if (!row) {
                    db.run('INSERT INTO users (id, balance, daily_last_claim) VALUES (?, ?, ?)', [userId, reward, now], (err) => {
                         if (err) console.error(err);
                         interaction.reply({ content: `🎁 You found a stash! Received **${reward}** Bottle Caps.` });
                    });
                } else {
                    db.run('UPDATE users SET balance = balance + ?, daily_last_claim = ? WHERE id = ?', [reward, now, userId], (err) => {
                         if (err) console.error(err);
                         interaction.reply({ content: `🎁 You found a stash! Received **${reward}** Bottle Caps.` });
                    });
                }
            });
        });
    }
}).toJSON();
