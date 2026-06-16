const Event = require('../../structure/Event');
const ChatRelay = require('../../utils/ChatRelay');
const { error } = require('../../utils/Console');

// Boots the FalloutChat in-game WebSocket relay once the bot is ready.
module.exports = new Event({
    event: 'clientReady',
    once: true,
    run: async (client) => {
        try {
            await ChatRelay.start(client);
        } catch (err) {
            error('[ChatRelay] Failed to start:', err);
        }
    }
}).toJSON();
