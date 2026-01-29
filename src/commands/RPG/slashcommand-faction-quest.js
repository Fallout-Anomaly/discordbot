const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const FactionManager = require('../../utils/FactionManager');

// Quest definitions per faction
const FACTION_QUESTS = {
    brotherhood: [
        {
            id: 'bos_patrol',
            name: 'Brotherhood Patrol',
            description: 'Scout the wasteland for tech and threats',
            reward: { caps: 150, rep: 15, xp: 100 },
            rank: 'Ally',
            type: 'exploration'
        },
        {
            id: 'bos_scribe_work',
            name: 'Scribe\'s Record',
            description: 'Catalog technology finds for the Brotherhood archives',
            reward: { caps: 100, rep: 10, xp: 75 },
            rank: 'Ally',
            type: 'collection'
        },
        {
            id: 'bos_radiation_cleanse',
            name: 'Radiation Cleanse',
            description: 'Clear radioactive zones to protect the Brotherhood',
            reward: { caps: 200, rep: 20, xp: 150 },
            rank: 'Veteran',
            type: 'combat'
        }
    ],
    institute: [
        {
            id: 'inst_synth_retrieval',
            name: 'Synth Retrieval',
            description: 'Recover escaped synths from the Commonwealth',
            reward: { caps: 180, rep: 15, xp: 120 },
            rank: 'Ally',
            type: 'combat'
        },
        {
            id: 'inst_component_scavenging',
            name: 'Component Scavenging',
            description: 'Gather advanced components for Institute experiments',
            reward: { caps: 120, rep: 10, xp: 80 },
            rank: 'Ally',
            type: 'collection'
        },
        {
            id: 'inst_espionage',
            name: 'Espionage Mission',
            description: 'Infiltrate and gather intelligence on rival factions',
            reward: { caps: 250, rep: 25, xp: 200 },
            rank: 'Veteran',
            type: 'stealth'
        }
    ],
    minutemen: [
        {
            id: 'mm_settlement_aid',
            name: 'Settlement Aid',
            description: 'Provide supplies and defense to struggling settlements',
            reward: { caps: 140, rep: 12, xp: 90 },
            rank: 'Ally',
            type: 'support'
        },
        {
            id: 'mm_caravan_escort',
            name: 'Caravan Escort',
            description: 'Protect merchant caravans traveling the Commonwealth',
            reward: { caps: 160, rep: 14, xp: 110 },
            rank: 'Ally',
            type: 'combat'
        },
        {
            id: 'mm_restore_liberty',
            name: 'Restore Liberty',
            description: 'Reclaim settlements from hostile forces',
            reward: { caps: 220, rep: 22, xp: 180 },
            rank: 'Veteran',
            type: 'combat'
        }
    ],
    railroad: [
        {
            id: 'rr_rescue_synth',
            name: 'Synth Rescue',
            description: 'Liberate enslaved synths from Institute control',
            reward: { caps: 170, rep: 16, xp: 130 },
            rank: 'Ally',
            type: 'stealth'
        },
        {
            id: 'rr_underground_network',
            name: 'Underground Network',
            description: 'Establish safe houses for synth refugees',
            reward: { caps: 130, rep: 11, xp: 85 },
            rank: 'Ally',
            type: 'support'
        },
        {
            id: 'rr_sabotage',
            name: 'Sabotage Mission',
            description: 'Disrupt Institute operations across the Commonwealth',
            reward: { caps: 240, rep: 23, xp: 190 },
            rank: 'Veteran',
            type: 'stealth'
        }
    ],
    raiders: [
        {
            id: 'raider_raid',
            name: 'The Raid',
            description: 'Lead a raiding party against settlements and traders',
            reward: { caps: 200, rep: 18, xp: 140 },
            rank: 'Ally',
            type: 'combat'
        },
        {
            id: 'raider_intimidate',
            name: 'Intimidation Job',
            description: 'Extort protection money from wasteland merchants',
            reward: { caps: 150, rep: 13, xp: 100 },
            rank: 'Ally',
            type: 'combat'
        },
        {
            id: 'raider_gang_war',
            name: 'Gang War',
            description: 'Assault rival raider gangs to expand Raider territory',
            reward: { caps: 260, rep: 25, xp: 200 },
            rank: 'Veteran',
            type: 'combat'
        }
    ],
    wastelanders: [
        {
            id: 'wast_water_supply',
            name: 'Water Supply Run',
            description: 'Deliver clean water to Wastelander settlements',
            reward: { caps: 120, rep: 10, xp: 75 },
            rank: 'Ally',
            type: 'support'
        },
        {
            id: 'wast_hunting',
            name: 'Hunting Expedition',
            description: 'Hunt irradiated creatures for food and materials',
            reward: { caps: 140, rep: 12, xp: 95 },
            rank: 'Ally',
            type: 'combat'
        },
        {
            id: 'wast_raider_defense',
            name: 'Raider Defense',
            description: 'Defend Wastelander settlements from Raider attacks',
            reward: { caps: 210, rep: 20, xp: 160 },
            rank: 'Veteran',
            type: 'combat'
        }
    ]
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('faction-quest')
        .setDescription('Accept faction quests and missions')
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List available quests for your faction')
        )
        .addSubcommand(sub =>
            sub.setName('accept')
                .setDescription('Accept a faction quest')
                .addStringOption(opt =>
                    opt.setName('quest')
                        .setDescription('Quest ID to accept')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('complete')
                .setDescription('Mark a quest as complete')
                .addStringOption(opt =>
                    opt.setName('quest')
                        .setDescription('Quest ID to complete')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        try {
            if (subcommand === 'list') {
                await listQuests(interaction, userId);
            } else if (subcommand === 'accept') {
                await acceptQuest(interaction, userId);
            } else if (subcommand === 'complete') {
                await completeQuest(interaction, userId);
            }
        } catch (error) {
            console.error('Faction quest error:', error);
            await interaction.reply({ content: 'Error processing quest command', ephemeral: true });
        }
    }
};

async function listQuests(interaction, userId) {
    try {
        const canAccess = await FactionManager.canAccessFactionQuests(userId);
        if (!canAccess) {
            await interaction.reply({
                content: '❌ You need **Ally** rank or higher in a faction to access quests',
                ephemeral: true
            });
            return;
        }

        const allegiance = await FactionManager.getPlayerAllegiance(userId);
        const stats = await FactionManager.getPlayerFactionStats(userId);
        const playerRank = stats[allegiance.faction_id]?.rank || 'Outsider';

        const factionId = allegiance.faction_id.toLowerCase();
        const quests = FACTION_QUESTS[factionId] || [];

        const embed = new EmbedBuilder()
            .setTitle(`📜 ${factionId.toUpperCase()} Faction Quests`)
            .setColor(0x1f8b4c)
            .setDescription(`Your Rank: **${playerRank}**`);

        quests.forEach(quest => {
            const isAvailable = isRankSufficient(playerRank, quest.rank);
            const status = isAvailable ? '✅' : '🔒';
            const rankReq = isAvailable ? '' : ` (Requires: ${quest.rank})`;

            embed.addFields({
                name: `${status} ${quest.name}`,
                value: `${quest.description}\n**Reward:** ${quest.reward.caps} caps + ${quest.reward.rep} rep + ${quest.reward.xp} XP\n**Type:** ${quest.type}${rankReq}`,
                inline: false
            });
        });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('List quests error:', error);
        await interaction.reply({ content: 'Error listing quests', ephemeral: true });
    }
}

async function acceptQuest(interaction, userId) {
    try {
        const questId = interaction.options.getString('quest');
        const allegiance = await FactionManager.getPlayerAllegiance(userId);
        const factionId = allegiance?.faction_id?.toLowerCase();

        if (!factionId) {
            await interaction.reply({
                content: '❌ You must join a faction first',
                ephemeral: true
            });
            return;
        }

        const quests = FACTION_QUESTS[factionId] || [];
        const quest = quests.find(q => q.id === questId);

        if (!quest) {
            await interaction.reply({
                content: '❌ Quest not found',
                ephemeral: true
            });
            return;
        }

        const stats = await FactionManager.getPlayerFactionStats(userId);
        const playerRank = stats[allegiance.faction_id]?.rank || 'Outsider';

        if (!isRankSufficient(playerRank, quest.rank)) {
            await interaction.reply({
                content: `❌ You need **${quest.rank}** rank to accept this quest. Current: **${playerRank}**`,
                ephemeral: true
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(`📋 Quest Accepted: ${quest.name}`)
            .setColor(0x1f8b4c)
            .setDescription(quest.description)
            .addFields(
                { name: 'Reward', value: `${quest.reward.caps} caps`, inline: true },
                { name: 'Reputation', value: `+${quest.reward.rep}`, inline: true },
                { name: 'Experience', value: `+${quest.reward.xp}`, inline: true }
            )
            .setFooter({ text: `Use /faction-quest complete ${questId} when done` });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('Accept quest error:', error);
        await interaction.reply({ content: 'Error accepting quest', ephemeral: true });
    }
}

async function completeQuest(interaction, userId) {
    try {
        const questId = interaction.options.getString('quest');
        const allegiance = await FactionManager.getPlayerAllegiance(userId);
        const factionId = allegiance?.faction_id?.toLowerCase();

        if (!factionId) {
            await interaction.reply({ content: '❌ You must join a faction first', ephemeral: true });
            return;
        }

        const quests = FACTION_QUESTS[factionId] || [];
        const quest = quests.find(q => q.id === questId);

        if (!quest) {
            await interaction.reply({ content: '❌ Quest not found', ephemeral: true });
            return;
        }

        // Award rewards
        await FactionManager.modifyReputation(userId, allegiance.faction_id, quest.reward.rep);

        const embed = new EmbedBuilder()
            .setTitle(`✅ Quest Complete: ${quest.name}`)
            .setColor(0x1f8b4c)
            .setDescription('Rewards granted!')
            .addFields(
                { name: 'Caps', value: `+${quest.reward.caps}`, inline: true },
                { name: 'Reputation', value: `+${quest.reward.rep}`, inline: true },
                { name: 'Experience', value: `+${quest.reward.xp}`, inline: true }
            );

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('Complete quest error:', error);
        await interaction.reply({ content: 'Error completing quest', ephemeral: true });
    }
}

function isRankSufficient(playerRank, requiredRank) {
    const ranks = ['Outsider', 'Neutral', 'Ally', 'Veteran', 'Champion'];
    const playerIndex = ranks.indexOf(playerRank);
    const requiredIndex = ranks.indexOf(requiredRank);
    return playerIndex >= requiredIndex;
}
