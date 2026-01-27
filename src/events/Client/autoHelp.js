const { Events, EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');

module.exports = new Event({
    event: Events.ClientReady,
    once: false,
    run: async (client) => {
        // Run every 24 hours
        setInterval(async () => {
            const channelId = process.env.AUTO_HELP_CHANNEL_ID;
            if (!channelId) return;

            const channel = client.channels.cache.get(channelId);
            if (!channel) {
                console.warn(`[AutoHelp] Channel ${channelId} not found.`);
                return;
            }

            // Fetch commands from the client collection
            const commands = client.collection.application_commands;
            
            const categories = {};

            commands.forEach((cmd) => {
                const category = 'General'; // You might want to categorize them better if your structure allows
                // Since this is a flat list, we'll try to guess or just list them all.
                // Or better, let's use the folder names if possible, but we don't have that info here easily without reading files.
                // We'll stick to a simple list for now.
                
                if (!categories['Commands']) categories['Commands'] = [];
                categories['Commands'].push(`\`/${cmd.command.name}\` - ${cmd.command.description}`);
            });

            const embed = new EmbedBuilder()
                .setTitle('🤖 Daily Command List')
                .setDescription('Here are the available commands you can use in the server:')
                .setColor('#0099ff')
                .setTimestamp();

            for (const [category, cmds] of Object.entries(categories)) {
                embed.addFields({ name: category, value: cmds.join('\n') });
            }

            // Optional: Delete previous bot messages in this channel to keep it clean?
            // For now, just send.
            
            try {
                await channel.send({ embeds: [embed] });
                console.log('[AutoHelp] Posted daily command list.');
            } catch (err) {
                console.error('[AutoHelp] Failed to send message:', err);
            }

        }, 24 * 60 * 60 * 1000); // 24 hours
    }
}).toJSON();
