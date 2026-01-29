const { EmbedBuilder, ApplicationCommandOptionType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const FactionManager = require('../../utils/FactionManager');
const { FACTION_QUESTS, QUEST_ENCOUNTERS } = require('../../utils/FactionQuestData');

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
        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO active_quests (user_id, quest_id, faction_id, started_at, complete_at) VALUES (?, ?, ?, ?, ?)',
                [userId, questId, questFaction, Date.now(), completeTime],
                function(err) {
                    if (err) {
                        console.error('Error inserting quest:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                }
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
        
        // Get active quest from database
        const activeQuest = await new Promise((resolve, reject) => {
            db.get(
                'SELECT quest_id, faction_id, started_at, complete_at FROM active_quests WHERE user_id = ?',
                [userId],
                (err, row) => {
                    if (err) {
                        console.error('Error querying active quest:', err);
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
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

        // Trigger random encounter instead of instant rewards
        await triggerEncounter(interaction, userId, activeQuest, quest);
    } catch (error) {
        console.error('Complete quest error:', error);
        await interaction.editReply({ content: 'Error completing quest' });
    }
}

async function triggerEncounter(interaction, userId, activeQuest, _quest) {
    try {
        // Pick random encounter scenario
        const scenario = QUEST_ENCOUNTERS[Math.floor(Math.random() * QUEST_ENCOUNTERS.length)];

        // Create action buttons with quest data
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`quest_attack_${userId}_${activeQuest.quest_id}`)
                .setLabel(scenario.options.attack.label)
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`quest_sneak_${userId}_${activeQuest.quest_id}`)
                .setLabel(scenario.options.sneak.label)
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`quest_talk_${userId}_${activeQuest.quest_id}`)
                .setLabel(scenario.options.talk.label)
                .setStyle(ButtonStyle.Primary)
        );

        const embed = new EmbedBuilder()
            .setTitle(`⚠️ ${scenario.title}`)
            .setDescription(`**${scenario.description}**\n\n${scenario.situation}\n\n*Choose your approach wisely. Different tactics have different success rates and rewards.*`)
            .addFields(
                { name: '⚔️ Attack', value: '**40% success** - Double rewards if successful', inline: true },
                { name: '🕵️ Sneak', value: '**70% success** - Normal rewards', inline: true },
                { name: '🗣️ Negotiate', value: '**90% success** - Half rewards', inline: true }
            )
            .setColor(0xFF8800);

        await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('Trigger encounter error:', error);
        await interaction.editReply({ content: 'Error triggering quest encounter' });
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
