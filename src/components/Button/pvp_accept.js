const { EmbedBuilder } = require('discord.js');
const Component = require('../../structure/Component');
const db = require('../../utils/EconomyDB');
const { checkLevelUp } = require('../../utils/LevelSystem');

module.exports = new Component({
    customId: 'pvp_accept_*',
    type: 'button',
    run: async (client, interaction) => {
        // Parse IDs from customId: pvp_accept_{attackerId}_{defenderId}
        const parts = interaction.customId.split('_');
        const attackerId = parts[2];
        const defenderId = parts[3];

        // Verify the button clicker is the defender
        if (interaction.user.id !== defenderId) {
            return interaction.reply({ 
                content: '❌ This challenge is not for you!', 
                flags: 64 
            });
        }

        // Disable buttons
        await interaction.update({ components: [] });

        // Defer a followup for the battle report
        await interaction.followUp({ content: '⚔️ **BATTLE COMMENCING...**', flags: 64 });

        // Execute PvP battle
        try {
            const attacker = await client.users.fetch(attackerId);
            await executePvP(attackerId, defenderId, client, db, interaction, attacker.username);
        } catch (error) {
            console.error('PvP execution error:', error);
            return interaction.editReply({ content: '❌ An error occurred during battle!' });
        }
    }
});

// PvP Battle Logic (copied from slashcommand-fight.js)
async function getPlayerStats(userId, db) {
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
}

async function executePvP(attId, defId, client, db, respond, attName) {
    const attStats = await getPlayerStats(attId, db);
    const defStats = await getPlayerStats(defId, db);

    let defName = 'Opponent';
    try {
        const user = await client.users.fetch(defId);
        defName = user.username;
    } catch {}

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

    // Check for level ups for both players
    const attOldData = await new Promise((resolve) => {
        db.get('SELECT xp FROM users WHERE id = ?', [attId], (err, row) => resolve(row || { xp: 0 }));
    });
    const defOldData = await new Promise((resolve) => {
        db.get('SELECT xp FROM users WHERE id = ?', [defId], (err, row) => resolve(row || { xp: 0 }));
    });

    const attOldXp = attOldData.xp || 0;
    const defOldXp = defOldData.xp || 0;
    const attNewXp = attOldXp + 100;
    const defNewXp = attWon ? defOldXp + 25 : defOldXp + 100;
    const attLevelCheck = checkLevelUp(attOldXp, attNewXp);
    const defLevelCheck = checkLevelUp(defOldXp, defNewXp);

    // Award XP and stat points with level ups
    if (attWon) {
        await new Promise((r) => db.run('UPDATE users SET balance = balance + 100, xp = xp + 100, stat_points = stat_points + ? WHERE id = ?', [attLevelCheck.levelsGained, attId], () => r()));
        await new Promise((r) => db.run('UPDATE users SET balance = balance + 25, xp = xp + 25, stat_points = stat_points + ? WHERE id = ?', [defLevelCheck.levelsGained, defId], () => r()));
    } else {
        await new Promise((r) => db.run('UPDATE users SET balance = balance + 25, xp = xp + 25, stat_points = stat_points + ? WHERE id = ?', [attLevelCheck.levelsGained, attId], () => r()));
        await new Promise((r) => db.run('UPDATE users SET balance = balance + 100, xp = xp + 100, stat_points = stat_points + ? WHERE id = ?', [defLevelCheck.levelsGained, defId], () => r()));
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

    // Add level up announcements if applicable
    if (attLevelCheck.leveledUp) {
        report.addFields({ name: '⭐ LEVEL UP! (Attacker)', value: `**Level ${attLevelCheck.newLevel}** 🎉\n+${attLevelCheck.levelsGained} SPECIAL Point${attLevelCheck.levelsGained > 1 ? 's' : ''} earned!`, inline: false });
    }
    if (defLevelCheck.leveledUp) {
        report.addFields({ name: '⭐ LEVEL UP! (Defender)', value: `**Level ${defLevelCheck.newLevel}** 🎉\n+${defLevelCheck.levelsGained} SPECIAL Point${defLevelCheck.levelsGained > 1 ? 's' : ''} earned!`, inline: false });
    }

    return respond.editReply({ embeds: [report] });
}
