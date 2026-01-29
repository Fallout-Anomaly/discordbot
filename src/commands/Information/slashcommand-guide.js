const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'guide',
        description: 'Interactive Survivor\'s Guide to all available commands.',
    },
    defer: { flags: 64 },
    run: async (client, interaction) => {
        const commands = client.collection.application_commands;
        const categories = {
            'economy': { name: '💰 Economy & RPG', cmds: [] },
            'faction': { name: '⚔️ Factions & Territory', cmds: [] },
            'utility': { name: '🔧 Utility & Info', cmds: [] },
            'fun': { name: '🎲 Fun & Extras', cmds: [] },
            'moderation': { name: '🛡️ Moderation', cmds: [] }
        };

        // Categorize commands manually for best accuracy
        commands.forEach((cmd) => {
            const name = cmd.command.name;
            const desc = cmd.command.description;
            const line = `\`/${name}\` - ${desc}`;

            // Factions & Territory
            if (['faction', 'faction-quest', 'territory'].includes(name)) {
                categories.faction.cmds.push(line);
            }
            // Economy & RPG
            else if (['balance', 'pay', 'daily', 'shop', 'scavenge', 'inventory', 'use', 'stats', 'quests', 'rob', 'radiation', 'nuka-cola', 'power-armor', 'fish', 'hunt', 'protection', 'stash', 'create-raffle', 'fight'].includes(name)) {
                categories.economy.cmds.push(line);
            } 
            // Utility & Info
            else if (['guide', 'help', 'ping', 'serverinfo', 'userinfo', 'report', 'learn', 'supporter-perks', 'donor-leaderboard', 'raffle-entries'].includes(name)) {
                categories.utility.cmds.push(line);
            } 
            // Fun & Extras
            else if (['coinflip', 'slots', 'leaderboard', 'embed', 'avatar', 'banner'].includes(name)) {
                categories.fun.cmds.push(line);
            }
            // Skip moderation/staff commands - they go in /staffguide instead
        });

        // 1. Create the Main Embed
        const embed = new EmbedBuilder()
            .setTitle('📖 Survivor\'s Field Guide')
            .setDescription('Select a category from the menu below to view available commands.\n\n**Categories:**\n⚔️ **Factions**: Join factions, earn reputation, claim territories, complete quests.\n💰 **Economy/RPG**: Trading, scavenging, items, combat, robbing, radiation, consumables, power armor, fishing, hunting.\n🔧 **Utility**: Information, help, supporter features.\n🎲 **Fun**: Games, gambling, and profiles.')
            .setColor('#27ae60')
            .setThumbnail('https://i.imgur.com/8Q9Q2Xn.png')
            .setFooter({ text: 'Select an option below • AnomalyBot' });

        // 2. Create the Select Menu (no moderation category)
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('guide_menu')
            .setPlaceholder('Select a Category')
            .addOptions(
                { label: 'Factions & Territory', description: 'Allegiance, Reputation, Quests, Territories', value: 'faction', emoji: '⚔️' },
                { label: 'Economy & RPG', description: 'Shop, Inv, Combat, Rob, Fish, Hunt', value: 'economy', emoji: '💰' },
                { label: 'Utility', description: 'Help, Info, Supporters', value: 'utility', emoji: '🔧' },
                { label: 'Fun & Extras', description: 'Gambling, Profile', value: 'fun', emoji: '🎲' }
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // 3. Send Initial Message and fetch for collectors
        await interaction.editReply({ 
            embeds: [embed], 
            components: [row]
        });

        const message = await interaction.fetchReply();

        // 4. Create Collector for Interaction on the Message object
        const collector = message.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 60000 // 1 minute timeout
        });

        collector.on('collect', async i => {
            try {
                // Acknowledge immediately to prevent timeout
                await i.deferUpdate();

                const selection = i.values[0];

                let responseEmbed;

                // Handle Faction-specific details
                if (selection === 'faction') {
                    responseEmbed = new EmbedBuilder()
                        .setTitle('⚔️ Factions & Territory System')
                        .setColor('#e74c3c')
                        .setDescription('**Master the wasteland through factions, reputation, and territorial control.**')
                        .addFields(
                            { name: '📋 Step 1: Build Reputation (Any Level)', value: 'Run `/faction status` to view your reputation with all factions. You start as **Outsider** (0 rep).\n\n**🎖️ Recruit Missions:** Complete basic "Recruit" quests for ANY faction to earn +5 rep each. Test factions before choosing! Use `/faction-quest list <faction>` and `/faction-quest accept <quest_id>` to try them out.\n\n**No allegiance required** - explore all factions with Recruit quests before making your permanent choice!', inline: false },
                            { name: '🎯 Step 2: Choose Your Allegiance (Level 10+)', value: 'Once you reach **Level 10**, run `/faction choose <faction>` to lock in your permanent faction. **This cannot be changed!**\n\n✨ **Instant Promotion:** Choosing a faction grants **25 reputation** (Ally rank) immediately, unlocking advanced faction quests!\n\n💡 **Pro Tip:** Complete Recruit missions (5 rep each) before choosing to reach **Neutral rank (10 rep)** or even **Ally rank (25 rep)** early!\n\nChoose wisely based on playstyle:\n• **Brotherhood**: Combat & weapons\n• **Institute**: Tech & energy weapons\n• **Minutemen**: Settlement income\n• **Railroad**: Stealth & liberation\n• **Raiders**: Chaos & loot\n• **Wastelanders**: Independence', inline: false },
                            { name: '📈 Step 3: Earn More Reputation', value: '**Complete faction quests** to gain reputation:\n\n**🎖️ Recruit Quests** (0-24 rep):\n• Available to ALL factions before allegiance\n• Short duration (5 min)\n• Awards: +5 rep, small caps/XP\n\n**⚔️ Ally Quests** (25+ rep):\n• Unlocked after choosing allegiance\n• Awards: +10-15 rep, better rewards\n\n**Commands:**\n1️⃣ `/faction-quest list <faction>` - View quests\n2️⃣ `/faction-quest accept <quest_id>` - Start\n3️⃣ `/faction-quest complete` - Claim rewards', inline: false },
                            { name: '⭐ Reputation Ranks & Unlocks', value: '**0 Rep - Outsider:** Can do Recruit quests (+5 rep each)\n**10 Rep - Neutral:** Continue Recruit quests\n**25 Rep - Ally:** Full quest access (requires allegiance)\n**60 Rep - Veteran:** Claim territories, tier-2 quests\n**100 Rep - Champion:** Max perks, tier-3 quests, leadership', inline: false },
                            { name: '🗺️ Step 4: Claim Territories (Veteran+)', value: '**At 60+ reputation**, use `/territory` to:\n• View all territories and their current control\n• Claim uncontrolled territories for your faction\n• Earn **50-80 caps/day passive income**\n• Grant faction-wide buffs (weapon bonuses, XP boosts, etc.)\n\n**Example:** `/territory claim cambridge_pd` (Brotherhood territory)', inline: false },
                            { name: '⚔️ Faction Hostility System', value: '**Choosing a faction makes enemies:**\n• Brotherhood vs Institute (mutual enemies)\n• Institute vs Railroad (mutual enemies)\n• Raiders vs Brotherhood/Minutemen/Wastelanders\n• Smugglers/Syndicate vs all lawful factions\n\n**You CANNOT do quests or interact with hostile factions!** Mercenaries remain neutral to all.', inline: false },
                            { name: '💎 Faction Perks (Passive Bonuses)', value: '**Ally rank:** Small bonuses (10% weapon durability, 5% energy damage)\n**Veteran rank:** Medium bonuses + stat boosts (+1 STR/CHA/INT)\n**Champion rank:** Maximum bonuses + unique abilities\n\nCheck your active perks with `/faction status` under the "Active Perks" section.', inline: false },
                            { name: '💡 Pro Tips & Strategy', value: '✓ **Grind to Ally ASAP** (25 rep) to unlock quests for faster progression\n✓ **Veteran rank** (60 rep) is key for territories and tier-2 quests\n✓ Complete quests daily for consistent rep gain\n✓ Territories provide free passive income—claim them!\n✓ Check `/faction status` regularly to track progress\n✓ Research faction enemies before choosing—you\'ll be locked in!', inline: false }
                        )
                        .setFooter({ text: 'Commands: /faction status • /faction choose • /faction-quest • /territory' });
                } else {
                    const category = categories[selection];
                    if (!category) return;

                    responseEmbed = new EmbedBuilder()
                        .setTitle(`${category.name}`)
                        .setDescription(category.cmds.join('\n') || "*No commands available.*")
                        .setColor('#f1c40f')
                        .setFooter({ text: 'Use the menu to switch categories.' });
                }

                await i.editReply({ embeds: [responseEmbed], components: [row] });
            } catch (err) {
                console.error('[GUIDE COLLECT] Error:', err);
            }
        });

        collector.on('end', () => {
             // Disable menu after timeout
             const disabledRow = new ActionRowBuilder().addComponents(
                 selectMenu.setDisabled(true).setPlaceholder('Menu Expired')
             );
             interaction.editReply({ components: [disabledRow] }).catch(() => {});
        });
    }
}).toJSON();
