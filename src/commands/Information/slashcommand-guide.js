const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'guide',
        description: 'Interactive Survivor\'s Guide to all available commands.',
    },
    defer: 'ephemeral',
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
                const category = categories[selection];

                if (!category) return;

                const categoryEmbed = new EmbedBuilder()
                    .setTitle(`${category.name}`)
                    .setDescription(category.cmds.join('\n') || "*No commands available.*")
                    .setColor('#f1c40f')
                    .setFooter({ text: 'Use the menu to switch categories.' });

                await i.editReply({ embeds: [categoryEmbed], components: [row] });
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
