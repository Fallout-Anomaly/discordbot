const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");
const config = require('../../config');
const { error } = require('../../utils/Console');

module.exports = new ApplicationCommand({
    command: {
        name: 'staffguide',
        description: 'Interactive Staff Guide for moderation and admin commands (Staff Only).',
    },
    run: async (client, interaction) => {
        // Check if user is staff
        const staffRoleId = config.roles?.staff_role || process.env.STAFF_ROLE_ID;
        if (!interaction.member.roles.cache.has(staffRoleId)) {
            return interaction.reply({ content: '❌ This command is for staff only.', flags: 64 });
        }

        const commands = client.collection.application_commands;
        const categories = {
            'moderation': { name: '🛡️ Moderation', cmds: [] },
            'support': { name: '💬 Support Management', cmds: [] },
            'donor': { name: '💎 Donor Management', cmds: [] },
            'developer': { name: '⚙️ Developer Tools', cmds: [] }
        };

        // Categorize staff commands
        commands.forEach((cmd) => {
            const name = cmd.command.name;
            const description = cmd.command.description;
            const line = `\`/${name}\` - ${description}`;

            // Moderation
            if (['ban', 'kick', 'mute', 'timeout', 'lock', 'unlock', 'clear', 'setup-verify', 'addrole', 'setnick'].includes(name)) {
                categories.moderation.cmds.push(line);
            }
            // Support Management
            else if (['cleanup-support', 'index-support', 'reset-support-followup'].includes(name)) {
                categories.support.cmds.push(line);
            }
            // Donor Management
            else if (['donor-manage', 'sync-donors'].includes(name)) {
                categories.donor.cmds.push(line);
            }
            // Developer Tools
            else if (['reload', 'eval', 'shutdown', 'emit', 'botinfo'].includes(name)) {
                categories.developer.cmds.push(line);
            }
        });

        // 1. Create the Main Embed
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Staff Command Guide')
            .setDescription('Select a category from the menu below to view staff commands.\n\n**Categories:**\n🛡️ **Moderation**: Ban, kick, timeout, lock.\n💬 **Support Management**: Thread cleanup & management.\n💎 **Donor Management**: Add/remove donors, sync roles.\n⚙️ **Developer Tools**: Bot management commands.')
            .setColor('#e74c3c')
            .setThumbnail('https://i.imgur.com/8Q9Q2Xn.png')
            .setFooter({ text: 'Staff Only • Select an option below' });

        // 2. Create the Select Menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('staffguide_menu')
            .setPlaceholder('Select a Category')
            .addOptions(
                { label: 'Moderation', description: 'User management tools', value: 'moderation', emoji: '🛡️' },
                { label: 'Support Management', description: 'Thread & cleanup tools', value: 'support', emoji: '💬' },
                { label: 'Donor Management', description: 'Manage supporters', value: 'donor', emoji: '💎' },
                { label: 'Developer Tools', description: 'Bot admin commands', value: 'developer', emoji: '⚙️' }
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // 3. Send Initial Message
        const message = await interaction.reply({ 
            embeds: [embed], 
            components: [row],
            flags: 64,
            fetchReply: true
        });

        // 4. Create Collector
        const collector = message.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 120000 // 2 minutes for staff
        });

        collector.on('collect', async i => {
            try {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: '❌ This menu is not for you!', flags: 64 });
                }

                await i.deferUpdate();

                const selection = i.values[0];
                const category = categories[selection];

                if (!category) return;

                const categoryEmbed = new EmbedBuilder()
                    .setTitle(`${category.name}`)
                    .setDescription(category.cmds.join('\n') || "*No commands available in this category.*")
                    .setColor('#e67e22')
                    .setFooter({ text: 'Use the menu to switch categories.' });

                await i.editReply({ embeds: [categoryEmbed], components: [row] });
            } catch (err) {
                error('[STAFFGUIDE COLLECT] Error:', err);
            }
        });

        collector.on('end', () => {
             const disabledRow = new ActionRowBuilder().addComponents(
                 selectMenu.setDisabled(true).setPlaceholder('Menu Expired')
             );
             interaction.editReply({ components: [disabledRow] }).catch(() => {});
        });
    }
}).toJSON();
