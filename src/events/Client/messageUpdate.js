const { Events, EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');

module.exports = new Event({
    event: Events.MessageUpdate,
    once: false,
    run: async (client, oldMessage, newMessage) => {
        // Ignore bots and webhooks
        if (newMessage.author?.bot) return;

        // Ignore partials (if we can't see the old message content, we can't log the diff)
        if (oldMessage.partial) return;

        // Ignore if content is the same (usually just an embed update)
        if (oldMessage.content === newMessage.content) return;

        const logChannelId = process.env.LOGS_CHANNEL_ID;
        if (!logChannelId) return;
        
        const logChannel = client.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('✏️ Message Edited')
            .setColor('#f1c40f') // Yellow
            .setAuthor({ name: newMessage.author.tag, iconURL: newMessage.author.displayAvatarURL() })
            .addFields(
                { name: 'Start', value: oldMessage.content.substring(0, 1024) || '*[No content]*' },
                { name: 'End', value: newMessage.content.substring(0, 1024) || '*[No content]*' },
                { name: 'Channel', value: `<#${newMessage.channel.id}>` },
                { name: 'Jump to Message', value: `[Click Here](${newMessage.url})` }
            )
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(err => console.error("[LOGGING] Failed to send edit log:", err));
    }
}).toJSON();
