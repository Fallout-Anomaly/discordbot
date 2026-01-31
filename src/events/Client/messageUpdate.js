const { Events, EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');
const { error } = require('../../utils/Console');

module.exports = new Event({
    event: Events.MessageUpdate,
    once: false,
    run: async (client, oldMessage, newMessage) => {
        // Ignore bots and webhooks
        if (newMessage.author?.bot) return;

        // Only log edits from messages posted within the last 24 hours to prevent spam from old messages
        const messageAge = Date.now() - newMessage.createdTimestamp;
        const twentyFourHours = 24 * 60 * 60 * 1000;
        if (messageAge > twentyFourHours) {
            return; // Ignore edits to old messages
        }

        // Handle partials so we can log content for uncached messages
        if (oldMessage && oldMessage.partial) {
            try {
                await oldMessage.fetch();
            } catch {
                // Ignore
            }
        }

        // Ignore if content is the same (usually just an embed update)
        if (oldMessage.content === newMessage.content) return;

        // Use Env Var
        const logChannelId = process.env.LOGS_CHANNEL_ID;
        if (!logChannelId) return;
        
        const logChannel = client.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const oldContent = oldMessage.content || '*[Content Not Available]*';
        const newContent = newMessage.content || '*[Content Not Available]*';

        const embed = new EmbedBuilder()
            .setTitle('✏️ Message Edited')
            .setColor('#f1c40f') // Yellow
            .setAuthor({ name: newMessage.author.tag, iconURL: newMessage.author.displayAvatarURL() })
            .addFields(
                { name: 'Start', value: oldContent.substring(0, Math.min(oldContent.length, 1024)) },
                { name: 'End', value: newContent.substring(0, Math.min(newContent.length, 1024)) },
                { name: 'Channel', value: `<#${newMessage.channel.id}>` },
                { name: 'Jump to Message', value: `[Click Here](${newMessage.url})` }
            )
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(err => error("[LOGGING] Failed to send edit log:", err));
    }
}).toJSON();
