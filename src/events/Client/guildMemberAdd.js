const { Events, EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');

module.exports = new Event({
    event: Events.GuildMemberAdd,
    once: false,
    run: async (client, member) => {
        const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
        if (!welcomeChannelId) {
            console.warn("[WELCOME] WELCOME_CHANNEL_ID is not set. Skipping welcome message.");
            return;
        }

        const verifyChannelId = process.env.VERIFY_CHANNEL_ID;
        // Defensive check: ensure it's a truthy value and NOT the literal string "undefined"
        const isValidVerifyId = verifyChannelId && verifyChannelId !== 'undefined';
        const verifyText = isValidVerifyId ? `<#${verifyChannelId}>` : "**verification channel**";

        if (!isValidVerifyId) {
            console.warn(`[WELCOME] VERIFY_CHANNEL_ID is missing or invalid: ${verifyChannelId}`);
        }

        let welcomeChannel = client.channels.cache.get(welcomeChannelId);
        // If channel isn't in cache (e.g., evicted after long runtime), fetch it
        if (!welcomeChannel) {
            welcomeChannel = await client.channels.fetch(welcomeChannelId).catch(() => null);
        }
        
        if (welcomeChannel) {
            // Calculate ordinal suffix (1st, 2nd, 3rd, 4th)
            const getOrdinal = (n) => {
                const s = ["th", "st", "nd", "rd"];
                const v = n % 100;
                return n + (s[(v - 20) % 10] || s[v] || s[0]);
            };

            // Retrieve member count directly
            const count = member.guild.memberCount;
            const ordinalCount = getOrdinal(count);

            const embed = new EmbedBuilder()
                .setTitle('☢️ A New Survivor Has Arrived!')
                .setDescription(`Welcome to the Wasteland, <@${member.user.id}>!\n\nPlease head over to ${verifyText} to verify yourself and access the rest of the server.`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setColor('#2ecc71') // Green
                .addFields(
                    { name: 'User', value: member.user.tag, inline: true },
                    { name: 'Survivor Count', value: `#${count}`, inline: true }
                )
                .setTimestamp();

            welcomeChannel.send({ 
                content: `<@${member.user.id}> has joined the server! You are our **${ordinalCount}** member!`, 
                embeds: [embed] 
            }).catch(err => console.error("[WELCOME] Failed to send message:", err));
        } else {
             console.warn(`[WELCOME] Welcome channel ${welcomeChannelId} not found in cache.`);
        }
    }
}).toJSON();
