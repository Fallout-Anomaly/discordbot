const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const FactionManager = require('../../utils/FactionManager');

// Quest definitions per faction
const FACTION_QUESTS = {
    brotherhood: [
        {
            id: 'bos_recruit_training',
            name: 'Recruit Training',
            description: 'Prove your worth in basic combat drills',
            reward: { caps: 50, rep: 5, xp: 30 },
            rank: 'Recruit',
            duration: 300000, // 5 minutes
            type: 'training'
        },
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
            id: 'inst_recruit_analysis',
            name: 'Data Analysis',
            description: 'Analyze sample data for Institute research',
            reward: { caps: 60, rep: 5, xp: 35 },
            rank: 'Recruit',
            duration: 300000, // 5 minutes
            type: 'research'
        },
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
            id: 'mm_recruit_assistance',
            name: 'Settlement Assistance',
            description: 'Help repair basic structures in a settlement',
            reward: { caps: 55, rep: 5, xp: 32 },
            rank: 'Recruit',
            duration: 300000, // 5 minutes
            type: 'support'
        },
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
            id: 'rr_recruit_courier',
            name: 'Courier Run',
            description: 'Deliver encoded messages through the Railroad network',
            reward: { caps: 65, rep: 5, xp: 38 },
            rank: 'Recruit',
            duration: 300000, // 5 minutes
            type: 'delivery'
        },
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
            id: 'raider_recruit_shakedown',
            name: 'Shake Down',
            description: 'Intimidate a small merchant for caps',
            reward: { caps: 70, rep: 5, xp: 40 },
            rank: 'Recruit',
            duration: 300000, // 5 minutes
            type: 'intimidation'
        },
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
            id: 'wast_recruit_scavenge',
            name: 'Scavenge Run',
            description: 'Gather basic supplies for the community',
            reward: { caps: 45, rep: 5, xp: 28 },
            rank: 'Recruit',
            duration: 300000, // 5 minutes
            type: 'gathering'
        },
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

module.exports = new ApplicationCommand({
    command: {
        name: 'faction-quest',
        description: 'Accept faction quests and missions',
        options: [
            {
                name: 'list',
                description: 'List available quests for your faction',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: 'faction',
                        description: 'View quests for a specific faction (optional)',
                        type: ApplicationCommandOptionType.String,
                        required: false,
                        choices: [
                            { name: '⚔️ Brotherhood', value: 'brotherhood' },
                            { name: '🤖 Institute', value: 'institute' },
                            { name: '🇺🇸 Minutemen', value: 'minutemen' },
                            { name: '🚆 Railroad', value: 'railroad' },
                            { name: '💀 Raiders', value: 'raiders' },
                            { name: '🏜️ Wastelanders', value: 'wastelanders' }
                        ]
                    }
                ]
            },
            {
                name: 'accept',
                description: 'Accept a faction quest',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: 'quest',
                        description: 'Quest ID to accept',
                        type: ApplicationCommandOptionType.String,
                        required: true,
                        autocomplete: true
                    }
                ]
            },
            {
                name: 'complete',
                description: 'Complete your active quest and claim rewards',
                type: ApplicationCommandOptionType.Subcommand
            }
        ]
    },
    defer: 'ephemeral',
    run: async (client, interaction) => {
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
            await interaction.editReply({ content: 'Error processing quest command' });
        }
    },
    autocomplete: async (client, interaction) => {
        try {
            // Show all quests from all factions with rank prefix
            const allQuests = [];
            
            // Add all quests from all factions (player can filter themselves)
            for (const [factionId, factionQuests] of Object.entries(FACTION_QUESTS)) {
                factionQuests.forEach(quest => {
                    allQuests.push({
                        name: `[${quest.rank}] ${quest.name} - ${factionId}`,
                        value: quest.id
                    });
                });
            }

            // Filter based on user input
            const focused = interaction.options.getFocused();
            const input = focused.toLowerCase();
            const filtered = allQuests
                .filter(q => 
                    q.value.toLowerCase().includes(input) || 
                    q.name.toLowerCase().includes(input)
                )
                .slice(0, 25);

            // If user typed something but found nothing, return empty (don't show default list)
            // Otherwise show matches or the first 25 defaults
            if (input.length > 0 && filtered.length === 0) {
                await interaction.respond([]);
            } else {
                await interaction.respond(filtered.length > 0 ? filtered : allQuests.slice(0, 25));
            }
        } catch (error) {
            console.error('Quest autocomplete error:', error);
            // Return empty array on error
            try {
                await interaction.respond([]);
            } catch {}
        }
    }
}).toJSON();

async function listQuests(interaction, userId) {
    try {
        const canAccess = await FactionManager.canAccessFactionQuests(userId);
        if (!canAccess) {
            await interaction.editReply({
                content: '❌ You need to be at least Level 10 to access faction quests'
            });
            return;
        }

        const factionOption = interaction.options.getString('faction');
        const allegiance = await FactionManager.getPlayerAllegiance(userId);
        const stats = await FactionManager.getPlayerFactionStats(userId);
        
        // Use provided faction or allegiance faction
        const factionId = factionOption ? factionOption.toLowerCase() : allegiance?.faction_id?.toLowerCase();
        
        if (!factionId) {
            await interaction.editReply({
                content: '❌ Please specify a faction or choose your allegiance first with `/faction choose`'
            });
            return;
        }
        
        const playerRank = stats[factionId]?.rank || 'Outsider';
        const hasAllegiance = allegiance?.faction_id === factionId;
        const quests = FACTION_QUESTS[factionId] || [];

        const embed = new EmbedBuilder()
            .setTitle(`📜 ${factionId.toUpperCase()} Faction Quests`)
            .setColor(0x1f8b4c)
            .setDescription(`${hasAllegiance ? 'Your Faction' : 'Viewing'} | Your Rank: **${playerRank}** (${stats[factionId]?.reputation || 0} rep)`);

        quests.forEach(quest => {
            // Show Recruit quests to everyone, show Ally+ quests only to those with allegiance
            const canSeeQuest = quest.rank === 'Recruit' || hasAllegiance;
            if (!canSeeQuest) return;
            
            const isAvailable = isRankSufficient(playerRank, quest.rank);
            const status = isAvailable ? '✅' : '🔒';
            const rankReq = isAvailable ? '' : ` (Requires: ${quest.rank})`;
            const duration = quest.duration ? ` | ${Math.floor(quest.duration / 60000)} min` : '';

            embed.addFields({
                name: `${status} ${quest.name}`,
                value: `${quest.description}\n**Reward:** ${quest.reward.caps} caps + ${quest.reward.rep} rep + ${quest.reward.xp} XP\n**Type:** ${quest.type}${duration}${rankReq}`,
                inline: false
            });
        });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('List quests error:', error);
        await interaction.editReply({ content: 'Error listing quests' });
    }
}

async function acceptQuest(interaction, userId) {
    try {
        const questId = interaction.options.getString('quest');
        const allegiance = await FactionManager.getPlayerAllegiance(userId);
        const stats = await FactionManager.getPlayerFactionStats(userId);

        // Find which faction this quest belongs to
        let questFaction = null;
        let quest = null;
        
        for (const [factionId, factionQuests] of Object.entries(FACTION_QUESTS)) {
            const foundQuest = factionQuests.find(q => q.id === questId);
            if (foundQuest) {
                questFaction = factionId;
                quest = foundQuest;
                break;
            }
        }

        if (!quest) {
            await interaction.editReply({
                content: '❌ Quest not found'
            });
            return;
        }

        // Recruit quests can be done for any faction, Ally+ quests require allegiance
        const hasAllegiance = allegiance?.faction_id === questFaction;
        if (quest.rank !== 'Recruit' && !hasAllegiance) {
            await interaction.editReply({ 
                content: `❌ This quest requires allegiance to **${questFaction}**. Recruit quests can be done for any faction!` 
            });
            return;
        }

        const playerRank = stats[questFaction]?.rank || 'Outsider';

        if (!isRankSufficient(playerRank, quest.rank)) {
            await interaction.editReply({
                content: `❌ You need **${quest.rank}** rank to accept this quest. Current: **${playerRank}**`
            });
            return;
        }

        const db = require('../../utils/EconomyDB');
        
        // Check for existing active quest (prevent overwriting progress)
        const existingQuest = await new Promise((resolve) => {
            db.get('SELECT quest_id, faction_id, complete_at FROM active_quests WHERE user_id = ?', [userId], (err, row) => resolve(row));
        });

        if (existingQuest) {
            const timeLeft = Math.floor((existingQuest.complete_at - Date.now()) / 1000 / 60);
            await interaction.editReply({ 
                content: `❌ You already have an active quest for **${existingQuest.faction_id}**! Complete or wait ${timeLeft} minutes before accepting a new one.` 
            });
            return;
        }

        const duration = quest.duration || 600000; // Default 10 minutes if not specified
        const completeTime = Date.now() + duration;

        // Store quest in database (INSERT only now that we've checked)
        await new Promise((resolve) => {
            db.run(
                'INSERT INTO active_quests (user_id, quest_id, faction_id, started_at, complete_at) VALUES (?, ?, ?, ?, ?)',
                [userId, questId, questFaction, Date.now(), completeTime],
                () => resolve()
            );
        });

        const embed = new EmbedBuilder()
            .setTitle(`📋 Quest Accepted: ${quest.name}`)
            .setColor(0x1f8b4c)
            .setDescription(`${quest.description}\n\n**Faction:** ${questFaction.charAt(0).toUpperCase() + questFaction.slice(1)}`)
            .addFields(
                { name: 'Reward', value: `${quest.reward.caps} caps`, inline: true },
                { name: 'Reputation', value: `+${quest.reward.rep}`, inline: true },
                { name: 'Experience', value: `+${quest.reward.xp}`, inline: true },
                { name: 'Complete After', value: `<t:${Math.floor(completeTime / 1000)}:R>`, inline: false }
            )
            .setFooter({ text: `Use /faction-quest complete when timer expires` });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Accept quest error:', error);
        await interaction.editReply({ content: 'Error accepting quest' });
    }
}

async function completeQuest(interaction, userId) {
    try {
        const db = require('../../utils/EconomyDB');
        const { checkLevelUp } = require('../../utils/LevelSystem');
        
        // Get active quest from database
        const activeQuest = await new Promise((resolve) => {
            db.get(
                'SELECT quest_id, faction_id, started_at, complete_at FROM active_quests WHERE user_id = ?',
                [userId],
                (err, row) => resolve(row)
            );
        });

        if (!activeQuest) {
            await interaction.editReply({ content: '❌ You don\'t have any active quests' });
            return;
        }

        // Check if quest is complete
        if (Date.now() < activeQuest.complete_at) {
            await interaction.editReply({ 
                content: `❌ Quest not ready yet. Complete <t:${Math.floor(activeQuest.complete_at / 1000)}:R>` 
            });
            return;
        }

        // Find quest definition
        const quests = FACTION_QUESTS[activeQuest.faction_id] || [];
        const quest = quests.find(q => q.id === activeQuest.quest_id);

        if (!quest) {
            await interaction.editReply({ content: '❌ Quest definition not found' });
            return;
        }

        // Award reputation to the quest's faction (not necessarily allegiance faction)
        const repResult = await FactionManager.modifyReputation(userId, activeQuest.faction_id, quest.reward.rep, 'quest');
        
        // Award caps and XP
        await new Promise((resolve) => {
            db.run(
                'UPDATE users SET caps = caps + ?, xp = xp + ? WHERE id = ?',
                [quest.reward.caps, quest.reward.xp, userId],
                () => resolve()
            );
        });

        // Check for level up
        const user = await new Promise((resolve) => {
            db.get('SELECT xp FROM users WHERE id = ?', [userId], (err, row) => resolve(row));
        });
        
        const levelCheck = await checkLevelUp(userId, user.xp - quest.reward.xp, user.xp);

        // Delete completed quest (CRITICAL: await to prevent race condition)
        await new Promise((resolve) => {
            db.run('DELETE FROM active_quests WHERE user_id = ?', [userId], () => resolve());
        });

        const embed = new EmbedBuilder()
            .setTitle(`✅ Quest Complete: ${quest.name}`)
            .setColor(0x1f8b4c)
            .setDescription(`**Faction:** ${activeQuest.faction_id.charAt(0).toUpperCase() + activeQuest.faction_id.slice(1)}\n\nRewards granted!`)
            .addFields(
                { name: 'Caps', value: `+${quest.reward.caps}`, inline: true },
                { name: 'Reputation', value: `+${quest.reward.rep} (${repResult.rank})`, inline: true },
                { name: 'Experience', value: `+${quest.reward.xp}`, inline: true }
            );

        if (levelCheck.leveledUp) {
            embed.addFields({
                name: '⭐ LEVEL UP!',
                value: `**Level ${levelCheck.newLevel}** 🎉\n+${levelCheck.levelsGained} SPECIAL Point${levelCheck.levelsGained > 1 ? 's' : ''} earned!`,
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Complete quest error:', error);
        await interaction.editReply({ content: 'Error completing quest' });
    }
}

function isRankSufficient(playerRank, requiredRank) {
    // Full rank hierarchy including Recruit tier
    const ranks = ['Outsider', 'Recruit', 'Neutral', 'Ally', 'Veteran', 'Champion'];
    
    // Recruit quests are available to everyone (Outsider and above)
    if (requiredRank === 'Recruit') {
        return true;
    }
    
    const playerIndex = ranks.indexOf(playerRank);
    const requiredIndex = ranks.indexOf(requiredRank);
    return playerIndex >= requiredIndex;
}
