const { Events } = require('discord.js');
const Event = require('../../structure/Event');
const fs = require('fs');
const path = require('path');

const TIMED_MESSAGES_FILE = path.resolve(__dirname, '../../data/timedMessages.json');

function loadTimedMessages() {
    try {
        return JSON.parse(fs.readFileSync(TIMED_MESSAGES_FILE, 'utf8'));
    } catch {
        return [];
    }
}

function saveTimedMessages(messages) {
    fs.writeFileSync(TIMED_MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf8');
}

module.exports = new Event({
    event: Events.ClientReady,
    once: true,
    run: async (client) => {
        setInterval(async () => {
            const messages = loadTimedMessages();
            const now = Date.now();

            for (const timedMsg of messages) {
                if (!timedMsg.enabled) continue;

                const lastSent = timedMsg.last_sent || 0;
                const intervalMs = timedMsg.interval_minutes * 60 * 1000;

                if (now - lastSent >= intervalMs) {
                    try {
                        const channel = await client.channels.fetch(timedMsg.channel_id);
                        if (!channel || !channel.isTextBased()) continue;

                        await channel.send(timedMsg.message_content);

                        timedMsg.last_sent = now;
                        saveTimedMessages(messages);
                    } catch (err) {
                        console.error(`[TimedMessages] Failed to send message ${timedMsg.id}:`, err.message);
                    }
                }
            }
        }, 30000); // Check every 30 seconds
    }
}).toJSON();
