const { Events } = require('discord.js');
const Event = require('../../structure/Event');
const config = require('../../config');
const AutoResponder = require('../../utils/AutoResponder');

module.exports = new Event({
    event: Events.MessageCreate,
    once: false,
    run: async (client, message) => {
        if (message.author.bot || !message.guild) return;

        // Check if channel is in the allowed list for Auto Response
        // AND ensure it is NOT the main AI channel (to avoid duplicate processing, though questionHandler handles that separately)
        // Actually, simpler: just check if it is in the config list.
        
        const monitorChannels = config.channels.auto_response || [];
        if (!monitorChannels.includes(message.channel.id)) return;

        // Run Auto Responder with error handling to prevent crash on database timeout or API error
        try {
            await AutoResponder.checkAndRespond(message);
        } catch (err) {
            console.error('[ChatAutoResponder] Error in checkAndRespond:', err);
        }
        
        // No AI generation here.
    }
}).toJSON();
