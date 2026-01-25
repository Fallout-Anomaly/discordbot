const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const Event = require('../../structure/Event');

module.exports = new Event({
    event: Events.MessageDelete,
    once: false,
    run: async (client, message) => {
        // Handle partials so we can log content for uncached messages
        if (message.partial) {
            try {
                await message.fetch();
            } catch (e) {
                // If message isn't fetchable (e.g. was deleted even before fetch), we log as much as we can.
            }
        }

        // Ignore bots
        if (message.author?.bot) return;

        const logChannelId = process.env.LOGS_CHANNEL_ID;
        if (!logChannelId) return;

        const logChannel = client.channels.cache.get(logChannelId);
        if (!logChannel) return;

        let content = message.content;
        if (!content && message.attachments && message.attachments.size > 0) {
            content = '*[Image/File Only]*';
        } else if (!content) {
            content = '*[Unknown Content]*';
        }

        // Wait a moment for Discord to populate audit logs
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Try to identify the executor (requires GuildModeration intent/permission)
        let executor = 'Unknown (User or Bot)';
        try {
            const fetchedLogs = await message.guild.fetchAuditLogs({
                limit: 5,
                type: AuditLogEvent.MessageDelete,
            });
            
            // Find the most relevant log entry within a reasonable timeframe
            const deletionLog = fetchedLogs.entries.find(entry => 
                entry.target.id === message.author.id && 
                Math.abs(entry.createdTimestamp - Date.now()) < 10000
            );

            if (deletionLog) {
                const { executor: logExecutor } = deletionLog;
                executor = `${logExecutor.tag} (${logExecutor.id})`;
            } else {
                executor = `${message.author.tag} (Self-Delete/Manual)`;
            }
        } catch (e) {
            // Logs likely failed due to permissions
            executor = `${message.author?.tag || 'Unknown User'} (Self-Delete or Missing Perms)`;
        }

        const embed = new EmbedBuilder()
            .setTitle('🗑️ Message Deleted')
            .setColor('#e74c3c') // Red
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .addFields(
                { name: 'Content', value: content.substring(0, 1024) },
                { name: 'Channel', value: `<#${message.channel.id}>` },
                { name: 'Deleted By', value: executor }
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
