const { info, error } = require('./utils/Console');

require('dotenv').config();
const fs = require('fs');
const DiscordBot = require('./client/DiscordBot');

fs.writeFileSync('./terminal.log', '', 'utf-8');
const client = new DiscordBot();

module.exports = client;

client.connect();

// Monitoring loop to catch silent exits/kills
setInterval(() => {
    const memory = process.memoryUsage();
    info(`[MONITOR] Bot is alive. Uptime: ${Math.round(process.uptime())}s | RSS: ${Math.round(memory.rss / 1024 / 1024)}MB | Heap: ${Math.round(memory.heapUsed / 1024 / 1024)}MB`);
}, 30000);

process.on('unhandledRejection', (err) => error('Unhandled Rejection:', err));
process.on('uncaughtException', (err) => error('Uncaught Exception:', err));

const db = require('./utils/EconomyDB');

const gracefulShutdown = () => {
    info('Received kill signal, shutting down gracefully...');
    db.close((err) => {
        if (err) {
            error('Error closing database:', err.message);
        } else {
            info('Database connection closed.');
        }
        client.destroy();
        process.exit(0);
    });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);