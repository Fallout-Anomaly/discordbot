const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const Event = require('../../structure/Event');

module.exports = new Event({
    event: Events.MessageDelete,
    once: false,
    run: async (client, message) => {
        // Ignore partials (We can't log content we never saw)
        if (message.partial) return;

        // Ignore bots
        if (message.author?.bot) return;

        // Use dedicated audit log channel if available, otherwise fallback to main logs
        const logChannelId = process.env.AUDIT_LOG_CHANNEL_ID || process.env.LOGS_CHANNEL_ID;
        if (!logChannelId) return;

        const logChannel = client.channels.cache.get(logChannelId);
        if (!logChannel) return;

        let content = message.content;
        if (!content && message.attachments.size > 0) {
            content = '*[Image/File Only]*';
        } else if (!content) {
            content = '*[Unknown Content]*';
        }

        const embed = new EmbedBuilder()
            .setTitle('🗑️ Message Deleted')
            .setColor('#e74c3c') // Red
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .addFields(
                { name: 'Content', value: content.substring(0, 1024) },
                { name: 'Channel', value: `<#${message.channel.id}>` }
            )
            .setFooter({ text: `Author ID: ${message.author.id}` })
            .setTimestamp();

        // Check if there were attachments
        if (message.attachments.size > 0) {
            embed.addFields({ name: 'Attachments', value: `${message.attachments.size} file(s) deleted.` });
        }

        logChannel.send({ embeds: [embed] }).catch(err => console.error("[LOGGING] Failed to send delete log:", err));
    }
}).toJSON();
