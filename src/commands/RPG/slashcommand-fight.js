const { EmbedBuilder, ApplicationCommandOptionType, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const db = require('../../utils/EconomyDB');
const { checkLevelUp } = require('../../utils/LevelSystem');
const { error } = require('../../utils/Console');

const ENEMIES = {
    'radroach': { name: '🪳 Radroach', hp: 15, damage: 3, special: { str: 1, agi: 2 }, loot: { caps: 10, item: null } },
    'bloatfly': { name: '🪰 Bloatfly', hp: 25, damage: 5, special: { str: 2, agi: 3 }, loot: { caps: 20, item: null } },
    'mole_rat': { name: '🐀 Mole Rat', hp: 40, damage: 8, special: { str: 3, agi: 2 }, loot: { caps: 35, item: null } },
    'radscorpion': { name: '🦂 Radscorpion', hp: 60, damage: 12, special: { str: 4, agi: 1 }, loot: { caps: 50, item: null } },
    'feral_ghoul': { name: '👹 Feral Ghoul', hp: 80, damage: 15, special: { str: 5, agi: 3 }, loot: { caps: 75, item: null } },
    'supermutant': { name: '🦾 Super Mutant', hp: 150, damage: 25, special: { str: 8, agi: 1 }, loot: { caps: 150, item: 'metal_armor' } }
};

module.exports = new ApplicationCommand({
    command: {
        name: 'fight',
        description: 'Battle wasteland creatures or other players. Uses your SPECIAL stats and inventory.',
        options: [
            {
                name: 'npc',
                description: 'Battle a wasteland creature',
                type: 1, // SUBCOMMAND
                options: [
                    {
                        name: 'enemy',
                        description: 'NPC enemy to fight',
                        type: ApplicationCommandOptionType.String,
                        required: true,
                        choices: Object.entries(ENEMIES).map(([key, data]) => ({
                            name: data.name,
                            value: key
                        }))
                    }
                ]
            },
            {
                name: 'pvp',
                description: 'Battle another player',
                type: 1, // SUBCOMMAND
                options: [
                    {
                        name: 'opponent',
                        description: 'Player to fight',
                        type: ApplicationCommandOptionType.User,
                        required: true
                    }
                ]
            }
        ]
    },
    defer: { flags: 64 },
    run: async (client, interaction) => {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'npc') {
            return await fightNPC(interaction, interaction.user.id, client, db);
        } else {
            const opponent = interaction.options.getUser('opponent');
            if (opponent.id === interaction.user.id) return interaction.editReply({ content: '❌ You cannot fight yourself!' });
            if (opponent.bot) return interaction.editReply({ content: '❌ You cannot fight bots!' });
            return await initiatePvP(interaction, interaction.user.id, opponent, client, db);
        }
    }
}).toJSON();

// Get player stats including equipment
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

    // FIX: Prevent dual-slot equipment - select best of each type
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

// Check PvP cooldowns
async function checkFightCooldowns(attackerId, db) {
    const now = Date.now();
    return new Promise((resolve) => {
        db.get('SELECT attacker_cooldown_expires FROM pvp_cooldowns WHERE user_id = ?', [attackerId], (err, row) => {
            if (!row || !row.attacker_cooldown_expires || row.attacker_cooldown_expires < now) {
                return resolve({ canFight: true });
            }
            const remaining = Math.ceil((row.attacker_cooldown_expires - now) / 60000);
            resolve({ canFight: false, reason: `⏳ You must wait ${remaining} minute(s) before fighting again.` });
        });
    });
}

// Set PvP cooldowns
async function setFightCooldowns(attackerId, defenderId, db) {
    const now = Date.now();
    const attackerExpiry = now + (24 * 60 * 60 * 1000);
    const defenderExpiry = now + (30 * 60 * 1000);

    return new Promise((resolve) => {
        db.run(
            `INSERT OR REPLACE INTO pvp_cooldowns (user_id, last_attacker_id, attacker_cooldown_expires, defender_cooldown_expires) 
             VALUES (?, ?, ?, ?)`,
            [attackerId, defenderId, attackerExpiry, defenderExpiry],
            () => resolve()
        );
    });
}

// NPC Fight
async function fightNPC(interaction, userId, client, db) {
    const enemyKey = interaction.options.getString('enemy');
    const enemy = JSON.parse(JSON.stringify(ENEMIES[enemyKey]));
    const playerStats = await getPlayerStats(userId, db);

    let playerHp = playerStats.maxHp, enemyHp = enemy.hp + (enemy.special.str * 5);
    const enemyDamage = enemy.damage + (enemy.special.str * 2);
    const battleLog = [];
    let turn = 0;

    while (playerHp > 0 && enemyHp > 0 && turn < 50) {
        turn++;
        
        if (Math.random() * 100 > enemy.special.agi * 5) {
            let dmg = playerStats.damage + Math.floor(Math.random() * playerStats.damage * 0.5);
            if (Math.random() * 100 < playerStats.crit) {
                dmg = Math.floor(dmg * 1.5);
                battleLog.push(`⚡ CRIT for ${dmg}!`);
            } else {
                battleLog.push(`✅ You hit for ${dmg}!`);
            }
            enemyHp = Math.max(0, enemyHp - dmg);
        } else {
            battleLog.push(`❌ Dodge!`);
        }

        if (enemyHp <= 0) break;

        if (Math.random() * 100 > playerStats.dodge) {
            let dmg = enemyDamage + Math.floor(Math.random() * enemyDamage * 0.3);
            dmg = Math.max(1, dmg - playerStats.defense);
            battleLog.push(`💥 Hit for ${dmg}!`);
            playerHp = Math.max(0, playerHp - dmg);
        } else {
            battleLog.push(`🛡️ You dodge!`);
        }
    }

    const won = enemyHp <= 0;
    const caps = won ? enemy.loot.caps : Math.floor(enemy.loot.caps * 0.25);
    const xp = won ? 50 + Math.floor(enemy.hp / 10) : 5;

    // FIX: Award loot drops
    let loot = '';
    if (won && enemy.loot.item && Math.random() < 0.25) {
        await new Promise((resolve) => {
            db.run('INSERT INTO inventory (user_id, item_id, amount) VALUES (?, ?, 1) ON CONFLICT(user_id, item_id) DO UPDATE SET amount = amount + 1',
                [userId, enemy.loot.item], (_err) => {
                    if (_err) error('Loot drop error:', _err);
                    resolve();
                });
        });
        loot = `🎁 **Rare Loot Drop!**\n`;
    }

    // Check for level up
    const userData = await new Promise((resolve) => {
        db.get('SELECT xp FROM users WHERE id = ?', [userId], (err, row) => resolve(row || { xp: 0 }));
    });
    const oldXp = userData.xp || 0;
    const newXp = oldXp + xp;
    const levelCheck = checkLevelUp(oldXp, newXp);

    await new Promise((resolve) => {
        db.run('UPDATE users SET balance = balance + ?, xp = xp + ?, stat_points = stat_points + ? WHERE id = ?', [caps, xp, levelCheck.levelsGained, userId], () => resolve());
    });

    const report = new EmbedBuilder()
        .setTitle(`⚔️ ${interaction.user.username}`)
        .setColor(won ? '#4CAF50' : '#E74C3C')
        .addFields(
            { name: '📊 Stats', value: `**DMG:** ${playerStats.damage} | **DEF:** ${playerStats.defense} | **Dodge:** ${playerStats.dodge}%`, inline: false },
            { name: '📋 Combat', value: battleLog.slice(-15).join('\n').slice(0, 1024), inline: false },
            { name: '⚔️ Result', value: won ? `🎉 **VICTORY!**\n\n${loot}💰 +${caps} Caps\n✨ +${xp} XP` : `💀 **DEFEAT!**\n\n💰 +${caps} Caps\n✨ +${xp} XP`, inline: false }
        )
        .setFooter({ text: `${turn} turns` });

    // Add level up announcement if applicable
    if (levelCheck.leveledUp) {
        report.addFields({ name: '⭐ LEVEL UP!', value: `**Level ${levelCheck.newLevel}** 🎉\n+${levelCheck.levelsGained} SPECIAL Point${levelCheck.levelsGained > 1 ? 's' : ''} earned!`, inline: false });
        report.setColor('#FFD700');
    }

    return interaction.editReply({ embeds: [report] });
}

// Initiate PvP
async function initiatePvP(interaction, attackerId, opponent, client, db) {
    const cooldown = await checkFightCooldowns(attackerId, db);
    if (!cooldown.canFight) return interaction.editReply({ content: cooldown.reason });

    const accept = new ButtonBuilder().setCustomId(`pvp_accept_${attackerId}_${opponent.id}`).setLabel('Accept').setStyle(ButtonStyle.Success);
    const decline = new ButtonBuilder().setCustomId(`pvp_decline_${attackerId}_${opponent.id}`).setLabel('Decline').setStyle(ButtonStyle.Danger);

    const embed = new EmbedBuilder()
        .setTitle('⚔️ PvP CHALLENGE')
        .setDescription(`${interaction.user.username} challenges you to a battle!`)
        .addFields({ name: 'Rewards', value: '**Win:** 100 Caps + 100 XP\n**Lose:** 25 Caps + 25 XP' })
        .setColor('#FF6B6B')
        .setFooter({ text: '60 second timeout' });

    try {
        await interaction.channel.send({ 
            content: `${opponent}`,
            embeds: [embed], 
            components: [new ActionRowBuilder().addComponents(accept, decline)] 
        });
        
        await setFightCooldowns(attackerId, opponent.id, db);
        return interaction.editReply({ content: `⚔️ Challenge issued to ${opponent}!` });
    } catch {
        return interaction.editReply({ content: `❌ Could not send challenge.` });
    }
}

// NOTE: PvP fight resolution lives in src/components/Button/pvp.js (the accept
// button handler). getPlayerStats is shared with it.
module.exports.getPlayerStats = getPlayerStats;
