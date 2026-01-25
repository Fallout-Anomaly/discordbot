const { Events, EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');

module.exports = new Event({
    event: Events.GuildMemberAdd,
    once: false,
    run: async (client, member) => {
        const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
        if (!welcomeChannelId) return;

        const welcomeChannel = client.channels.cache.get(welcomeChannelId);
        if (welcomeChannel) {
            const embed = new EmbedBuilder()
                .setTitle('☢️ A New Survivor Has Arrived!')
                .setDescription(`Welcome to the Wasteland, <@${member.user.id}>! We're glad to have you here at Anomaly.`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setColor('#2ecc71') // Green
                .addFields(
                    { name: 'User', value: member.user.tag, inline: true },
                    { name: 'Total Members', value: `${member.guild.memberCount}`, inline: true }
                )
                .setTimestamp();

            welcomeChannel.send({ content: `Welcome <@${member.user.id}>!`, embeds: [embed] }).catch(err => console.error("[WELCOME] Failed to send message:", err));
        }
    }
}).toJSON();
