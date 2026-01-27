const { Events } = require('discord.js');
const Event = require('../../structure/Event');
const db = require('../../utils/EconomyDB');

// Simple XP System
// 10-20 XP per message
// 1 min cooldown
const xpCooldowns = new Set();

module.exports = new Event({
    event: Events.MessageCreate,
    once: false,
    run: async (client, message) => {
        if (message.author.bot || !message.guild) return;

        // Rate limit: 1 XP gain per minute per user
        if (xpCooldowns.has(message.author.id)) return;

        const xpGain = Math.floor(Math.random() * 11) + 10; // 10-20 XP

        db.serialize(() => {
            // Ensure user exists, then add XP
            db.run('INSERT OR IGNORE INTO users (id, balance, xp) VALUES (?, 0, 0)', [message.author.id]);
            db.run('UPDATE users SET xp = xp + ? WHERE id = ?', [xpGain, message.author.id], (err) => {
                if (err) console.error('XP Update Error:', err);
            });
        });

        // Add to cooldown
        xpCooldowns.add(message.author.id);
        setTimeout(() => {
            xpCooldowns.delete(message.author.id);
        }, 60000); // 1 minute
    }
}).toJSON();
