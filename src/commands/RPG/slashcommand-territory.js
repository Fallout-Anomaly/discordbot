const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const FactionManager = require('../../utils/FactionManager');
const EconomyDB = require('../../utils/EconomyDB');
const { error } = require('../../utils/Console');

module.exports = new ApplicationCommand({
    command: {
        name: 'territory',
        description: 'View and manage faction territories',
        options: [
            {
                name: 'list',
                description: 'List all territories and their controlling factions',
                type: ApplicationCommandOptionType.Subcommand
            },
            {
                name: 'income',
                description: 'Check passive income from your faction\'s territories',
                type: ApplicationCommandOptionType.Subcommand
            },
            {
                name: 'claim',
                description: 'Claim a territory for your faction',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: 'territory',
                        description: 'Territory to claim',
                        type: ApplicationCommandOptionType.String,
                        required: true,
                        choices: [
                            { name: '🏢 Cambridge Police Department (Brotherhood)', value: 'cambridge_pd' },
                            { name: '🔬 The Institute (Institute)', value: 'the_institute' },
                            { name: '🚂 Railroad HQ (Railroad)', value: 'railroad_hq' },
                            { name: '🏰 The Castle (Minutemen)', value: 'the_castle' },
                            { name: '💀 Corvega Assembly (Raiders)', value: 'corvega' },
                            { name: '🏚️ Vault 81 (Wastelanders)', value: 'vault_81' }
                        ]
                    }
                ]
            }
        ]
    },
    defer: { flags: 64 },
    run: async (client, interaction) => {
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
        } catch (err) {
            error('Territory command error:', err);
            await interaction.editReply({ content: 'Error processing territory command' });
        }
    }
}).toJSON();

async function showTerritoryList(interaction) {
    const db = EconomyDB.getDatabase();
    return new Promise((resolve) => {
        db.all(`
            SELECT territory_id, controlling_faction 
            FROM territories 
            ORDER BY controlling_faction
        `, async (err, territories) => {
            if (err) {
                await interaction.editReply({ content: 'Database error' });
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

            await interaction.editReply({ embeds: [embed] });
            resolve();
        });
    });
}

async function showIncome(interaction, userId) {
    try {
        const income = await FactionManager.getTerritoryIncome(userId);
        const allegiance = await FactionManager.getPlayerAllegiance(userId);

        if (!allegiance?.faction_id) {
            await interaction.editReply({
                content: '❌ You must join a faction first to earn territory income'
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

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        error('Income command error:', err);
        await interaction.editReply({ content: 'Error calculating income' });
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

            await interaction.editReply({
                content: `❌ You need **Veteran** rank or higher to claim territories. Current rank: **${rank}**`
            });
            return;
        }

        const allegiance = await FactionManager.getPlayerAllegiance(userId);
        const { TERRITORIES } = FactionManager;
        const territory = TERRITORIES[territoryId];

        if (!territory) {
            await interaction.editReply({ content: '❌ Territory not found' });
            return;
        }

        return new Promise((resolve) => {
            db.get(`SELECT controlling_faction FROM territories WHERE territory_id = ?`, [territoryId], async (err, row) => {
                if (err) {
                    await interaction.editReply({ content: 'Database error' });
                    return resolve();
                }

                const currentFaction = row?.controlling_faction;

                // Check if player faction already controls it
                if (currentFaction === allegiance.faction_id) {
                    await interaction.editReply({
                        content: `✅ Your faction already controls **${territory.name}**`
                    });
                    return resolve();
                }

                // Challenge if already controlled (null or 'None' means unclaimed)
                if (currentFaction && currentFaction !== 'None') {
                    await interaction.editReply({
                        content: `⚔️ **${territory.name}** is controlled by **${currentFaction}**\n\nTo take it, your faction will need to contest it in combat.\n\n*This feature coming soon!*`
                    });
                    return resolve();
                }

                // Claim uncontrolled territory
                db.run(`UPDATE territories SET controlling_faction = ? WHERE territory_id = ?`, 
                    [allegiance.faction_id, territoryId], 
                    async (err) => {
                        if (err) {
                            await interaction.editReply({ content: 'Error claiming territory' });
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

                        await interaction.editReply({ embeds: [embed] });
                        resolve();
                    }
                );
            });
        });
    } catch (err) {
        error('Claim territory error:', err);
        await interaction.editReply({ content: 'Error claiming territory' });
    }
}
