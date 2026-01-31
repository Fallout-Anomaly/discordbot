const { Events } = require('discord.js');
const Event = require('../../structure/Event');
const db = require('../../utils/EconomyDB');
const { error } = require('../../utils/Console');

// Simple XP System
// 10-20 XP per message
// 1 min cooldown (persisted in database for restart resilience)

// Initialize Table
db.run(`CREATE TABLE IF NOT EXISTS xp_cooldowns (
    user_id TEXT PRIMARY KEY,
    cooldown_expiry INTEGER
)`);

module.exports = new Event({
    event: Events.MessageCreate,
    once: false,
    run: async (client, message) => {
        if (message.author.bot || !message.guild) return;

        const userId = message.author.id;
        const now = Date.now();

        // Check if user has active cooldown in database
        db.get('SELECT cooldown_expiry FROM xp_cooldowns WHERE user_id = ?', [userId], async (err, row) => {
            if (err) {
                error('XP Cooldown Check Error:', err);
                return;
            }

            // If cooldown exists and hasn't expired, skip XP gain
            if (row && row.cooldown_expiry > now) {
                return;
            }

            const xpGain = Math.floor(Math.random() * 11) + 10; // 10-20 XP
            const cooldownExpiry = now + 60000; // 1 minute from now

            // Use UPSERT for atomic operation: insert new user or update XP in a single atomic call
            // This prevents race conditions where two rapid messages could cause double-inserts or lock errors
            const xpQuery = `
                INSERT INTO users (id, balance, xp) 
                VALUES (?, 0, ?) 
                ON CONFLICT(id) DO UPDATE SET xp = IFNULL(xp, 0) + ?
            `;
            db.run(xpQuery, [userId, xpGain, xpGain], (err) => {
                if (err) error('XP Update Error:', err);
            });

            // Update cooldown in database
            const cooldownQuery = `
                INSERT INTO xp_cooldowns (user_id, cooldown_expiry)
                VALUES (?, ?)
                ON CONFLICT(user_id) DO UPDATE SET cooldown_expiry = ?
            `;
            db.run(cooldownQuery, [userId, cooldownExpiry, cooldownExpiry], (err) => {
                if (err) error('XP Cooldown Update Error:', err);
            });
        });
    }
}).toJSON();
