const { EmbedBuilder } = require('discord.js');
const Component = require('../../structure/Component');
const db = require('../../utils/EconomyDB');

module.exports = new Component({
    customId: /^pvp_(accept|decline)_\d+_\d+$/,
    type: 'button',
    options: {
        public: true
    },
    async run(client, interaction) {
        const [, action, attackerId, defenderId] = interaction.customId.match(/^pvp_(accept|decline)_(\d+)_(\d+)$/);

        // Only the challenged player can respond
        if (interaction.user.id !== defenderId) {
            return interaction.reply({ content: '❌ Only the challenged player can respond!', ephemeral: true });
        }

        if (action === 'decline') {
            await interaction.deferReply({ flags: 64 });
            await interaction.editReply({ content: `❌ ${interaction.user.username} declined the challenge.` });
            return interaction.message.edit({ components: [] });
        }

        // ACCEPT - execute the fight
        await interaction.deferReply();

        // Get player stats
        const getPlayerStats = async (userId) => {
            const playerData = await new Promise((resolve) => {
                db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                    resolve(row || { id: userId, stat_strength: 1, stat_agility: 1, stat_endurance: 1, stat_luck: 1, balance: 0, xp: 0 });
                });
            });

            const inventory = await new Promise((resolve) => {
                db.all(
                    `SELECT i.name, i.id, i.damage, i.defense FROM inventory inv 
                     JOIN items i ON inv.item_id = i.id 
                     WHERE inv.user_id = ? AND inv.amount > 0 AND (i.type = 'weapon' OR i.type = 'armor')`,
                    [userId],
                    (err, rows) => resolve(rows || [])
                );
            });

            const selectedIds = new Set();
            let weapon = null, armor = null;

            for (const item of inventory.sort((a, b) => (b.damage || 0) - (a.damage || 0))) {
                if (item.damage && !selectedIds.has(item.id)) {
                    weapon = item;
                    selectedIds.add(item.id);
                    break;
                }
            }

            for (const item of inventory.sort((a, b) => (b.defense || 0) - (a.defense || 0))) {
                if (item.defense && !selectedIds.has(item.id)) {
                    armor = item;
                    selectedIds.add(item.id);
                    break;
                }
            }

            if (!weapon) weapon = { name: 'Fists', damage: 2, id: 'fists' };
            if (!armor) armor = { name: 'Vault Suit', defense: 2, id: 'vault_suit' };

            return {
                data: playerData,
                weapon, armor,
                maxHp: 50 + (playerData.stat_endurance * 10),
                damage: 5 + (playerData.stat_strength * 2) + (weapon.damage || 0),
                dodge: playerData.stat_agility * 5,
                crit: playerData.stat_luck * 3,
                defense: (armor.defense || 0) + Math.floor(playerData.stat_endurance * 0.5)
            };
        };

        const attStats = await getPlayerStats(attackerId);
        const defStats = await getPlayerStats(defenderId);

        let attName = 'Attacker';
        let defName = 'Defender';
        try {
            const attUser = await client.users.fetch(attackerId);
            attName = attUser.username;
        } catch {}
        try {
            const defUser = await client.users.fetch(defenderId);
            defName = defUser.username;
        } catch {}

        // Execute fight
        let attHp = attStats.maxHp, defHp = defStats.maxHp;
        const log = [];
        let turn = 0;

        while (attHp > 0 && defHp > 0 && turn < 100) {
            turn++;

            if (Math.random() * 100 > defStats.dodge) {
                let dmg = attStats.damage + Math.floor(Math.random() * attStats.damage * 0.5);
                dmg = Math.max(1, dmg - defStats.defense);
                log.push(`✅ ${attName}: ${dmg} dmg`);
                defHp -= dmg;
            } else {
                log.push(`❌ ${defName} dodges`);
            }

            if (defHp <= 0) break;

            if (Math.random() * 100 > attStats.dodge) {
                let dmg = defStats.damage + Math.floor(Math.random() * defStats.damage * 0.5);
                dmg = Math.max(1, dmg - attStats.defense);
                log.push(`💥 ${defName}: ${dmg} dmg`);
                attHp -= dmg;
            } else {
                log.push(`🛡️ ${attName} dodges`);
            }
        }

        const attWon = attHp > 0;
        if (attWon) {
            await new Promise((r) => db.run('UPDATE users SET balance = balance + 100, xp = xp + 100 WHERE id = ?', [attackerId], () => r()));
            await new Promise((r) => db.run('UPDATE users SET balance = balance + 25, xp = xp + 25, health = health - ? WHERE id = ?', [attStats.maxHp - attHp, defenderId], () => r()));
        } else {
            await new Promise((r) => db.run('UPDATE users SET balance = balance + 25, xp = xp + 25, health = health - ? WHERE id = ?', [defStats.maxHp - defHp, attackerId], () => r()));
            await new Promise((r) => db.run('UPDATE users SET balance = balance + 100, xp = xp + 100 WHERE id = ?', [defenderId], () => r()));
        }

        const report = new EmbedBuilder()
            .setTitle('⚔️ PvP RESULT')
            .setColor(attWon ? '#FFD700' : '#C0C0C0')
            .addFields(
                { name: attName, value: `DMG: ${attStats.damage} | DEF: ${attStats.defense}`, inline: true },
                { name: defName, value: `DMG: ${defStats.damage} | DEF: ${defStats.defense}`, inline: true },
                { name: 'Battle', value: log.slice(-20).join('\n').slice(0, 1024) },
                { name: 'Result', value: attWon ? `🎉 ${attName} WINS!\n💰 +100\n✨ +100 XP` : `🎉 ${defName} WINS!\n💰 +100\n✨ +100 XP` }
            );

        await interaction.editReply({ embeds: [report] });
        await interaction.message.edit({ components: [] });
    }
});
