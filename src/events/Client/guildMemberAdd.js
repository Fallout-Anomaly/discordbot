const { Events, EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');

module.exports = new Event({
    event: Events.GuildMemberAdd,
    once: false,
    run: async (client, member) => {
        const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
        const verifyChannelId = process.env.VERIFY_CHANNEL_ID;
        if (!welcomeChannelId) return;

        const welcomeChannel = client.channels.cache.get(welcomeChannelId);
        if (welcomeChannel) {
            // Calculate ordinal suffix (1st, 2nd, 3rd, 4th)
            const getOrdinal = (n) => {
                const s = ["th", "st", "nd", "rd"];
                const v = n % 100;
                return n + (s[(v - 20) % 10] || s[v] || s[0]);
            };

            // Force fetch member count to ensure accuracy
            try {
                await member.guild.fetch(); 
            } catch (e) {}

            const memberCount = getOrdinal(member.guild.memberCount);

            const embed = new EmbedBuilder()
                .setTitle('☢️ A New Survivor Has Arrived!')
                .setDescription(`Welcome to the Wasteland, <@${member.user.id}>!\n\nPlease head over to <#${verifyChannelId}> to verify yourself and access the rest of the server.`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setColor('#2ecc71') // Green
                .addFields(
                    { name: 'User', value: member.user.tag, inline: true },
                    { name: 'Survivor Count', value: `#${member.guild.memberCount}`, inline: true }
                )
                .setTimestamp();

            welcomeChannel.send({ 
                content: `<@${member.user.id}> has joined the server! You are our **${memberCount}** member!`, 
                embeds: [embed] 
            }).catch(err => console.error("[WELCOME] Failed to send message:", err));
        }
    }
}).toJSON();
