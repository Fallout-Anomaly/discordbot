const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const FactionManager = require('../../utils/FactionManager');
const EconomyDB = require('../../utils/EconomyDB');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('territory')
        .setDescription('View and manage faction territories')
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all territories and their controlling factions')
        )
        .addSubcommand(sub =>
            sub.setName('income')
                .setDescription('Check passive income from your faction\'s territories')
        )
        .addSubcommand(sub =>
            sub.setName('claim')
                .setDescription('Claim a territory for your faction')
                .addStringOption(opt =>
                    opt.setName('territory')
                        .setDescription('Territory to claim')
                        .setRequired(true)
                        .addChoices(
                            { name: '🏢 Cambridge Police Department (Brotherhood)', value: 'cambridge_pd' },
                            { name: '🔬 The Institute (Institute)', value: 'the_institute' },
                            { name: '🚂 Railroad HQ (Railroad)', value: 'railroad_hq' },
                            { name: '🏰 The Castle (Minutemen)', value: 'the_castle' },
                            { name: '💀 Corvega Assembly (Raiders)', value: 'corvega' },
                            { name: '🏚️ Vault 81 (Wastelanders)', value: 'vault_81' }
                        )
                )
        ),

    async execute(interaction) {
        const db = EconomyDB.getDatabase();
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        try {
            if (subcommand === 'list') {
                await showTerritoryList(interaction);
            } else if (subcommand === 'income') {
                await showIncome(interaction, userId);
            } else if (subcommand === 'claim') {
                await claimTerritory(interaction, userId, db);
            }
        } catch (error) {
            console.error('Territory command error:', error);
            await interaction.reply({ content: 'Error processing territory command', ephemeral: true });
        }
    }
};

async function showTerritoryList(interaction) {
    const db = EconomyDB.getDatabase();
    return new Promise((resolve) => {
        db.all(`
            SELECT territory_id, controlling_faction 
            FROM territories 
            ORDER BY controlling_faction
        `, async (err, territories) => {
            if (err) {
                await interaction.reply({ content: 'Database error', ephemeral: true });
                return resolve();
            }

            const { TERRITORIES } = require('../../utils/FactionManager');
            const embed = new EmbedBuilder()
                .setTitle('⚔️ Territory Control Map')
                .setColor(0x1f8b4c)
                .setDescription('Current faction territory holdings');

            for (const [territoryId, info] of Object.entries(TERRITORIES)) {
                const controlled = territories.find(t => t.territory_id === territoryId);
                const faction = controlled?.controlling_faction || 'None';
                embed.addFields({
                    name: `${info.emoji} ${info.name}`,
                    value: `**Controlling:** ${faction}\n**Income:** +${info.passive_income} caps/day\n**Buff:** ${info.buff_type} +${info.buff_value * 100}%`,
                    inline: false
                });
            }

            await interaction.reply({ embeds: [embed] });
            resolve();
        });
    });
}

async function showIncome(interaction, userId) {
    try {
        const income = await FactionManager.getTerritoryIncome(userId);
        const allegiance = await FactionManager.getPlayerAllegiance(userId);

        if (!allegiance?.faction_id) {
            await interaction.reply({
                content: '❌ You must join a faction first to earn territory income',
                ephemeral: true
            });
            return;
        }

        const territories = await FactionManager.getTerritoryControl(userId);
        const { TERRITORIES } = FactionManager;

        const embed = new EmbedBuilder()
            .setTitle('💰 Territory Income')
            .setColor(0x1f8b4c)
            .setDescription(`**Daily Income:** +${income} caps`);

        if (territories.length === 0) {
            embed.addFields({
                name: 'No Territories',
                value: 'Your faction controls no territories yet. Claim one with `/territory claim`'
            });
        } else {
            let incomeBreakdown = '';
            territories.forEach(t => {
                const info = TERRITORIES[t.territory_id];
                if (info) incomeBreakdown += `• ${info.emoji} ${info.name}: +${info.passive_income} caps\n`;
            });
            embed.addFields({
                name: 'Territory Breakdown',
                value: incomeBreakdown
            });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('Income command error:', error);
        await interaction.reply({ content: 'Error calculating income', ephemeral: true });
    }
}

async function claimTerritory(interaction, userId, db) {
    try {
        const territoryId = interaction.options.getString('territory');
        const canClaim = await FactionManager.canClaimTerritory(userId);

        if (!canClaim) {
            const stats = await FactionManager.getPlayerFactionStats(userId);
            const allegiance = await FactionManager.getPlayerAllegiance(userId);
            const rank = stats[allegiance?.faction_id]?.rank || 'Outsider';

            await interaction.reply({
                content: `❌ You need **Veteran** rank or higher to claim territories. Current rank: **${rank}**`,
                ephemeral: true
            });
            return;
        }

        const allegiance = await FactionManager.getPlayerAllegiance(userId);
        const { TERRITORIES } = FactionManager;
        const territory = TERRITORIES[territoryId];

        if (!territory) {
            await interaction.reply({ content: '❌ Territory not found', ephemeral: true });
            return;
        }

        return new Promise((resolve) => {
            db.get(`SELECT controlling_faction FROM territories WHERE territory_id = ?`, [territoryId], async (err, row) => {
                if (err) {
                    await interaction.reply({ content: 'Database error', ephemeral: true });
                    return resolve();
                }

                const currentFaction = row?.controlling_faction;

                // Check if player faction already controls it
                if (currentFaction === allegiance.faction_id) {
                    await interaction.reply({
                        content: `✅ Your faction already controls **${territory.name}**`,
                        ephemeral: true
                    });
                    return resolve();
                }

                // Challenge if already controlled (null or 'None' means unclaimed)
                if (currentFaction && currentFaction !== 'None') {
                    await interaction.reply({
                        content: `⚔️ **${territory.name}** is controlled by **${currentFaction}**\n\nTo take it, your faction will need to contest it in combat.\n\n*This feature coming soon!*`,
                        ephemeral: true
                    });
                    return resolve();
                }

                // Claim uncontrolled territory
                db.run(`UPDATE territories SET controlling_faction = ? WHERE territory_id = ?`, 
                    [allegiance.faction_id, territoryId], 
                    async (err) => {
                        if (err) {
                            await interaction.reply({ content: 'Error claiming territory', ephemeral: true });
                            return resolve();
                        }

                        // Award rep for territory claim
                        await FactionManager.modifyReputation(userId, allegiance.faction_id, 5);

                        const embed = new EmbedBuilder()
                            .setTitle('🚩 Territory Claimed!')
                            .setColor(0x1f8b4c)
                            .setDescription(`Your faction has claimed **${territory.name}**`)
                            .addFields(
                                { name: 'Passive Income', value: `+${territory.passive_income} caps/day`, inline: true },
                                { name: 'Buff Type', value: territory.buff_type, inline: true },
                                { name: 'Rep Bonus', value: '+5 reputation', inline: true }
                            );

                        await interaction.reply({ embeds: [embed] });
                        resolve();
                    }
                );
            });
        });
    } catch (error) {
        console.error('Claim territory error:', error);
        await interaction.reply({ content: 'Error claiming territory', ephemeral: true });
    }
}
