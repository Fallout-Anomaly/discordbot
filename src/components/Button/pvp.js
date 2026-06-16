const { EmbedBuilder } = require('discord.js');
const Component = require('../../structure/Component');
const db = require('../../utils/EconomyDB');
const { checkLevelUp } = require('../../utils/LevelSystem');

module.exports = new Component({
    customId: /^pvp_(accept|decline)_\d+_\d+$/,
    type: 'button',
    options: {
        public: true
    },
    async run(client, interaction) {
        const [, action, attackerId, defenderId] = interaction.customId.match(/^pvp_(accept|decline)_(\d+)_(\d+)$/);

        // interactionCreate already deferred this interaction ephemerally.
        // Only the challenged player can respond.
        if (interaction.user.id !== defenderId) {
            return interaction.editReply({ content: '❌ Only the challenged player can respond!' });
        }

        if (action === 'decline') {
            await interaction.editReply({ content: `❌ ${interaction.user.username} declined the challenge.` });
            return interaction.message.edit({ components: [] }).catch(() => {});
        }

        // ACCEPT - execute the fight (already deferred; result posted publicly below)

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
        // Reward XP/caps and grant SPECIAL points on level-up (parity with NPC fights).
        const attReward = attWon ? 100 : 25;
        const defReward = attWon ? 25 : 100;
        const attLevels = checkLevelUp(attStats.data.xp || 0, (attStats.data.xp || 0) + attReward).levelsGained;
        const defLevels = checkLevelUp(defStats.data.xp || 0, (defStats.data.xp || 0) + defReward).levelsGained;

        if (attWon) {
            await new Promise((r) => db.run('UPDATE users SET balance = balance + ?, xp = xp + ?, stat_points = stat_points + ? WHERE id = ?', [attReward, attReward, attLevels, attackerId], () => r()));
            await new Promise((r) => db.run('UPDATE users SET balance = balance + ?, xp = xp + ?, stat_points = stat_points + ?, health = health - ? WHERE id = ?', [defReward, defReward, defLevels, attStats.maxHp - attHp, defenderId], () => r()));
        } else {
            await new Promise((r) => db.run('UPDATE users SET balance = balance + ?, xp = xp + ?, stat_points = stat_points + ?, health = health - ? WHERE id = ?', [attReward, attReward, attLevels, defStats.maxHp - defHp, attackerId], () => r()));
            await new Promise((r) => db.run('UPDATE users SET balance = balance + ?, xp = xp + ?, stat_points = stat_points + ? WHERE id = ?', [defReward, defReward, defLevels, defenderId], () => r()));
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

        // The deferred reply is ephemeral; show the result publicly by editing the
        // original challenge message, and give the clicker a private acknowledgement.
        await interaction.message.edit({ embeds: [report], components: [] }).catch(() => {});
        await interaction.editReply({ content: '⚔️ Fight resolved — see the result above!' });
    }
});
