const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const db = require('../../utils/EconomyDB');
const FactionManager = require('../../utils/FactionManager');
const { calculateLevel } = require('../../utils/LevelSystem');

module.exports = new ApplicationCommand({
    command: {
        name: 'faction',
        description: 'View faction standings, perks, and manage your allegiance.',
        options: [
            {
                name: 'status',
                description: 'View your faction standings',
                type: 1 // SUBCOMMAND
            },
            {
                name: 'choose',
                description: 'Lock in your allegiance (level 10+ required)',
                type: 1, // SUBCOMMAND
                options: [
                    {
                        name: 'faction',
                        description: 'Choose your allegiance',
                        type: ApplicationCommandOptionType.String,
                        required: true,
                        choices: [
                            { name: '⚔️ Brotherhood of Steel', value: 'brotherhood' },
                            { name: '🤖 Institute', value: 'institute' },
                            { name: '🇺🇸 Minutemen', value: 'minutemen' },
                            { name: '🚆 Railroad', value: 'railroad' },
                            { name: '💀 Raiders', value: 'raiders' },
                            { name: '🏜️ Independent Wastelanders', value: 'wastelanders' },
                            { name: '🏴 Smugglers', value: 'smugglers' },
                            { name: '🔫 Mercenaries', value: 'mercenaries' },
                            { name: '💼 Wasteland Syndicate', value: 'syndicate' }
                        ]
                    }
                ]
            }
        ]
    },
    defer: { flags: 64 },
    run: async (client, interaction) => {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        // Get user XP and calculate actual level
        const userData = await new Promise((resolve) => {
            db.get('SELECT xp FROM users WHERE id = ?', [userId], (err, row) => {
                resolve(row || { xp: 0 });
            });
        });
        const userLevel = calculateLevel(userData.xp);

        // Initialize factions if needed
        await FactionManager.initializePlayerFactions(userId);

        if (subcommand === 'status') {
            return await showStatus(interaction, userId);
        } else if (subcommand === 'choose') {
            const factionId = interaction.options.getString('faction');
            return await chooseFaction(interaction, userId, factionId, userLevel);
        }
    }
}).toJSON();

async function showStatus(interaction, userId) {
    const stats = await FactionManager.getPlayerFactionStats(userId);
    const allegiance = await FactionManager.getPlayerAllegiance(userId);
    const perks = await FactionManager.getPlayerPerks(userId);

    // Separate major and black-market
    const major = Object.entries(stats).filter(([_, s]) => s.type === 'major');
    const blackMarket = Object.entries(stats).filter(([_, s]) => s.type === 'black-market');

    // Build major factions field
    let majorText = '';
    major.forEach(([factionId, data]) => {
        const isAllegiance = allegiance?.faction_id === factionId ? '👑' : '';
        majorText += `${data.emoji} **${data.name}** ${isAllegiance}\n`;
        majorText += `  Rep: ${data.reputation}/100 | Rank: ${data.rank}\n`;
    });

    // Build black-market field
    let blackText = '';
    blackMarket.forEach(([factionId, data]) => {
        const isAllegiance = allegiance?.faction_id === factionId ? '👑' : '';
        blackText += `${data.emoji} **${data.name}** ${isAllegiance}\n`;
        blackText += `  Rep: ${data.reputation}/100 | Rank: ${data.rank}\n`;
    });

    // Build perks field
    let perksText = 'None yet';
    if (perks.length > 0) {
        perksText = perks.map(p => `• ${p.name}: +${p.value}`).join('\n');
    }

    // Build hostility field
    const hostile = await FactionManager.getHostileFactions(userId);
    let hostileText = 'None';
    if (hostile.length > 0) {
        const states = { 0: '✅ Neutral', 1: '⚠️ Suspicious', 2: '☠️ Hostile', 3: '💀 KOS' };
        hostileText = hostile.map(h => `${h.emoji} ${h.name}: ${states[h.hostility_state]}`).join('\n');
    }

    const embed = new EmbedBuilder()
        .setTitle('📊 FACTION STATUS')
        .setColor(allegiance ? stats[allegiance.faction_id]?.color || '#808080' : '#666666')
        .addFields(
            { name: '⚔️ MAJOR FACTIONS', value: majorText || 'None', inline: false },
            { name: '🏴 BLACK MARKET', value: blackText || 'None', inline: false },
            { name: '✨ ACTIVE PERKS', value: perksText, inline: false },
            { name: '☠️ HOSTILITY', value: hostileText, inline: false }
        );

    if (allegiance) {
        embed.addFields({
            name: '👑 YOUR ALLEGIANCE',
            value: `${stats[allegiance.faction_id]?.emoji} ${allegiance.name}\n${allegiance.allegiance_locked ? '🔒 LOCKED' : '🔓 Unlocked'}`,
            inline: false
        });
    } else {
        embed.addFields({
            name: '👑 ALLEGIANCE',
            value: 'No allegiance chosen. At level 10, use `/faction choose` to lock in your path.',
            inline: false
        });
    }

    return interaction.editReply({ embeds: [embed] });
}

async function chooseFaction(interaction, userId, factionId, userLevel) {
    const result = await FactionManager.chooseAllegiance(userId, factionId, userLevel);

    if (!result.success) {
        return interaction.editReply({ content: `❌ ${result.reason}` });
    }

    const faction = await new Promise((resolve) => {
        db.get('SELECT name, emoji FROM factions WHERE id = ?', [factionId], (err, row) => resolve(row));
    });

    const embed = new EmbedBuilder()
        .setTitle('🔒 ALLEGIANCE LOCKED')
        .setColor('#FFD700')
        .setDescription(`${faction.emoji} You are now aligned with **${faction.name}**.\n\nYour choices will have consequences. Some paths are now closed to you. Others will open.`)
        .addFields(
            { name: 'What This Means', value: '• Other major factions will view you with suspicion\n• Some quests will no longer be available\n• Your perks and rewards are now faction-specific\n• Your allegiance cannot be changed' }
        );

    return interaction.editReply({ embeds: [embed] });
}
