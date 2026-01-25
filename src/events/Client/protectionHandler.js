const { Events, EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');

// Cache for spam detection
const messageHistory = new Map();
const SPAM_THRESHOLD = 5; // messages
const SPAM_INTERVAL = 5000; // ms

module.exports = new Event({
    event: Events.MessageCreate,
    once: false,
    run: async (client, message) => {
        if (message.author.bot || !message.guild) return;

        // Bypass for staff
        const staffRoleId = process.env.STAFF_ROLE_ID;
        if (staffRoleId && message.member.roles.cache.has(staffRoleId)) return;

        const logChannelId = process.env.LOGS_CHANNEL_ID;
        const logChannel = client.channels.cache.get(logChannelId);

        // 1. Link Protection
        const linkPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
        if (linkPattern.test(message.content)) {
            try {
                await message.delete();
                const warning = await message.channel.send(`<@${message.author.id}>, external links are not allowed in this channel.`);
                setTimeout(() => warning.delete().catch(() => {}), 5000);

                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🛡️ Link Blocked')
                        .setColor('#ff0000')
                        .addFields(
                            { name: 'User', value: `${message.author.tag} (${message.author.id})` },
                            { name: 'Channel', value: `<#${message.channel.id}>` },
                            { name: 'Content', value: message.content }
                        )
                        .setTimestamp();
                    logChannel.send({ embeds: [embed] });
                }
                return; // Stop further checks if deleted
            } catch (e) {
                console.error("[PROTECTION] Link delete failed:", e.message);
            }
        }

        // 2. Anti-Spam
        const now = Date.now();
        const userData = messageHistory.get(message.author.id) || [];
        const recentMessages = userData.filter(ts => now - ts < SPAM_INTERVAL);
        recentMessages.push(now);
        messageHistory.set(message.author.id, recentMessages);

        if (recentMessages.length > SPAM_THRESHOLD) {
            try {
                // Timeout user for 10 minutes
                await message.member.timeout(10 * 60 * 1000, "Automated Anti-Spam");
                await message.channel.send(`⚠️ <@${message.author.id}> has been timed out for spamming.`);

                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🛡️ Spam Detected')
                        .setColor('#ffaa00')
                        .addFields(
                            { name: 'User', value: `${message.author.tag} (${message.author.id})` },
                            { name: 'Action', value: '10 Minute Timeout' }
                        )
                        .setTimestamp();
                    logChannel.send({ embeds: [embed] });
                }
                // Clear history to prevent double trigger
                messageHistory.delete(message.author.id);
            } catch (e) {
                console.error("[PROTECTION] Spam timeout failed:", e.message);
            }
        }
    }
}).toJSON();
