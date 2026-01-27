const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const Event = require('../../structure/Event');

module.exports = new Event({
    event: Events.MessageDelete,
    once: false,
    run: async (client, message) => {
        // Use Env Var
        const logChannelId = process.env.LOGS_CHANNEL_ID;
        if (!logChannelId) return;

        const logChannel = client.channels.cache.get(logChannelId);
        if (!logChannel) return;

        // Handle partials
        if (message.partial) {
            try {
                await message.fetch();
            } catch (e) {
               // Log debug if needed, but acceptable to fail if message is gone
               // console.debug(`[LOGS] Could not fetch partial message ${message.id}:`, e.message);
            }
        }
        
        // Ignore bots
        if (message.author?.bot) return;

        let content = message.content;
        if (!content && message.attachments && message.attachments.size > 0) {
            content = '*[Image/File Only]*';
        } else if (!content) {
            content = '*[Unknown Content]*';
        }

        let executor = 'Unknown (User or Bot)';
        
        // Check permissions before fetching audit logs
        if (message.guild.members.me.permissions.has('ViewAuditLog')) {
             let deletionLog;
             // Retry mechanism: Try up to 3 times to find the log
             for (let i = 0; i < 3; i++) {
                 try {
                     const fetchedLogs = await message.guild.fetchAuditLogs({
                         limit: 1,
                         type: AuditLogEvent.MessageDelete,
                     });
                     const log = fetchedLogs.entries.first();
                     // Match criteria: Target is author, created recently (within 10s)
                     if (log && log.target.id === message.author.id && 
                         (Date.now() - log.createdTimestamp) < 10000) {
                         deletionLog = log;
                         break;
                     }
                 } catch (e) {
                     // Ignore transient errors
                 }
                 // Wait 500ms before retry
                 await new Promise(resolve => setTimeout(resolve, 500));
             }

             if (deletionLog) {
                 const executorTag = deletionLog.executor ? deletionLog.executor.tag : 'Unknown Executor';
                 const executorId = deletionLog.executor ? deletionLog.executor.id : '???';
                 executor = `${executorTag} (${executorId})`;
             } else {
                 if (message.author) {
                    executor = `${message.author.tag} (Self-Delete or Log Not Found)`;
                 } else {
                    executor = 'Unknown Author (Log Not Found)';
                 }
             }
        } else {
             if (message.author) {
                 executor = `${message.author.tag} (Self-Delete / No Log Perms)`;
             } else {
                 executor = 'Unknown Author (No Log Perms)';
             }
        }

        const embed = new EmbedBuilder()
            .setTitle('🗑️ Message Deleted')
            .setColor('#e74c3c') // Red
            .setAuthor({ name: message.author ? message.author.tag : 'Unknown User', iconURL: message.author ? message.author.displayAvatarURL() : undefined })
            .addFields(
                { name: 'Content', value: content.substring(0, 1024) },
                { name: 'Channel', value: `<#${message.channel.id}>` },
                { name: 'Deleted By', value: executor }
            )
            .setFooter({ text: `Author ID: ${message.author ? message.author.id : 'Unknown'}` })
            .setTimestamp();

        // Check if there were attachments
        if (message.attachments.size > 0) {
            embed.addFields({ name: 'Attachments', value: `${message.attachments.size} file(s) deleted.` });
        }

        logChannel.send({ embeds: [embed] }).catch(err => console.error("[LOGGING] Failed to send delete log:", err));
    }
}).toJSON();
