const { info, error } = require('./utils/Console');

require('dotenv').config();
const fs = require('fs');
const DiscordBot = require('./client/DiscordBot');

fs.writeFileSync('./terminal.log', '', 'utf-8');
const client = new DiscordBot();

module.exports = client;

client.connect();

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