const { Events, EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');
const { info, warn, error } = require('../../utils/Console');

let helpInterval = null;

module.exports = new Event({
    event: Events.ClientReady,
    once: false,
    run: async (client) => {
        // Clear any existing interval to prevent duplicates on Ready event resumption
        if (helpInterval) clearInterval(helpInterval);
        
        // Run every 24 hours
        helpInterval = setInterval(async () => {
            const channelId = process.env.AUTO_HELP_CHANNEL_ID;
            if (!channelId) return;

            const channel = client.channels.cache.get(channelId);
            if (!channel) {
                warn(`[AutoHelp] Channel ${channelId} not found.`);
                return;
            }

            // Fetch commands from the client collection
            const commands = client.collection.application_commands;
            
            const categories = {};

            commands.forEach((cmd) => {
                if (!categories['Commands']) categories['Commands'] = [];
                categories['Commands'].push(`\`/${cmd.command.name}\` - ${cmd.command.description}`);
            });

            // Split command fields to respect Discord's 1024 character limit per field
            const embeds = [];
            let currentEmbed = new EmbedBuilder()
                .setTitle('🤖 Daily Command List')
                .setDescription('Here are the available commands you can use in the server:')
                .setColor('#0099ff')
                .setTimestamp();

            for (const [category, cmds] of Object.entries(categories)) {
                const commandText = cmds.join('\n');
                
                // If adding this field would exceed 1024 chars, create a new embed
                if (commandText.length > 1024) {
                    // Split long categories into pages
                    let currentPage = '';
                    for (const cmd of cmds) {
                        if ((currentPage + cmd + '\n').length > 1024) {
                            if (currentPage) {
                                const pageNum = embeds.length + 1;
                                currentEmbed.addFields({ name: `${category} (Page ${pageNum})`, value: currentPage.trim() });
                                embeds.push(currentEmbed);
                                currentEmbed = new EmbedBuilder()
                                    .setColor('#0099ff')
                                    .setTimestamp();
                            }
                            currentPage = cmd + '\n';
                        } else {
                            currentPage += cmd + '\n';
                        }
                    }
                    if (currentPage) {
                        const pageNum = embeds.length + 1;
                        currentEmbed.addFields({ name: `${category} (Page ${pageNum})`, value: currentPage.trim() });
                    }
                } else {
                    currentEmbed.addFields({ name: category, value: commandText });
                }
            }

            // Add the final embed if it has fields
            if (currentEmbed.data.fields?.length > 0) {
                embeds.push(currentEmbed);
            }

            // Send all embeds (Discord allows multiple embeds per message up to 10)
            try {
                if (embeds.length > 0) {
                    await channel.send({ embeds: embeds.slice(0, 10) }); // Cap at 10 embeds per message
                    info(`[AutoHelp] Posted daily command list (${embeds.length} embed${embeds.length > 1 ? 's' : ''}).`);
                }
            } catch (err) {
                error('[AutoHelp] Failed to send message:', err);
            }

        }, 24 * 60 * 60 * 1000); // 24 hours
    }
}).toJSON();
