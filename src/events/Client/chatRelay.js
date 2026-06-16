const { Events } = require('discord.js');
const Event = require('../../structure/Event');
const ChatRelay = require('../../utils/ChatRelay');
const { error } = require('../../utils/Console');

// Mirrors Discord messages into the game chat and handles relay moderation
// commands (!ban / !unban / !bans / !whois / !blockname / ...). Only messages in
// the configured relay channel are touched; everything else is ignored.
module.exports = new Event({
    event: Events.MessageCreate,
    once: false,
    run: async (client, message) => {
        try {
            await ChatRelay.handleMessage(message);
        } catch (err) {
            error('[ChatRelay] Error handling message:', err);
        }
    }
}).toJSON();
