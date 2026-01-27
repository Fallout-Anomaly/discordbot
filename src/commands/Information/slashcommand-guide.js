const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'guide',
        description: 'Interactive Survivor\'s Guide to all available commands.',
    },
    run: async (client, interaction) => {
        const commands = client.collection.application_commands;
        const categories = {
            'economy': { name: '💰 Economy & RPG', cmds: [] },
            'utility': { name: '🔧 Utility & Info', cmds: [] },
            'fun': { name: '🎲 Fun & Extras', cmds: [] },
            'moderation': { name: '🛡️ Moderation', cmds: [] }
        };

        // Categorize commands manually for best accuracy
        commands.forEach((cmd) => {
            const name = cmd.command.name;
            const desc = cmd.command.description;
            const line = `\`/${name}\` - ${desc}`;

            if (['balance', 'pay', 'daily', 'shop', 'scavenge', 'inventory', 'use', 'stats', 'quests'].includes(name)) {
                categories.economy.cmds.push(line);
            } else if (['guide', 'help', 'ping', 'serverinfo', 'userinfo', 'report', 'learn'].includes(name)) {
                categories.utility.cmds.push(line);
            } else if (['coinflip', 'slots', 'leaderboard', 'embed', 'avatar', 'banner'].includes(name)) {
                categories.fun.cmds.push(line);
            } else if (['ban', 'kick', 'mute', 'timeout', 'lock', 'unlock', 'clear', 'setup-verify', 'addrole', 'setnick'].includes(name)) {
                // Only show moderation tostaff? We'll put it in menu but maybe hide if not staff? 
                // For simplicity, let's include it but label it.
                if (interaction.member.permissions.has('ManageMessages')) {
                    categories.moderation.cmds.push(line);
                }
            }
        });

        // 1. Create the Main Embed
        const embed = new EmbedBuilder()
            .setTitle('📖 Survivor\'s Field Guide')
            .setDescription('Select a category from the menu below to view available commands.\n\n**Categories:**\n💰 **Economy/RPG**: Trading, scavenging, items.\n🔧 **Utility**: Information and help.\n🎲 **Fun**: Games and profiles.\n🛡️ **Moderation**: Staff tools.')
            .setColor('#27ae60')
            .setThumbnail('https://i.imgur.com/8Q9Q2Xn.png')
            .setFooter({ text: 'Select an option below • AnomalyBot' });

        // 2. Create the Select Menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('guide_menu')
            .setPlaceholder('Select a Category')
            .addOptions(
                { label: 'Economy & RPG', description: 'Shop, Inv, Scavenge', value: 'economy', emoji: '💰' },
                { label: 'Utility', description: 'Help, Info, Report', value: 'utility', emoji: '🔧' },
                { label: 'Fun & Extras', description: 'Gambling, Profile', value: 'fun', emoji: '🎲' }
            );

        if (categories.moderation.cmds.length > 0) {
            selectMenu.addOptions({ label: 'Moderation', description: 'Staff Only Tools', value: 'moderation', emoji: '🛡️' });
        }

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // 3. Send Initial Message
        const response = await interaction.reply({ 
            embeds: [embed], 
            components: [row],
            fetchReply: true // Important for collector
        });

        // 4. Create Collector for Interaction
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 60000 // 1 minute timeout
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '❌ This menu is not for you!', ephemeral: true });
            }

            const selection = i.values[0];
            const category = categories[selection];

            const categoryEmbed = new EmbedBuilder()
                .setTitle(`${category.name}`)
                .setDescription(category.cmds.join('\n') || "*No commands available.*")
                .setColor('#f1c40f')
                .setFooter({ text: 'Use the menu to switch categories.' });

            await i.update({ embeds: [categoryEmbed], components: [row] });
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
