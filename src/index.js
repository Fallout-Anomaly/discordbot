require('dotenv').config();
const fs = require('fs');
const DiscordBot = require('./client/DiscordBot');

fs.writeFileSync('./terminal.log', '', 'utf-8');
const client = new DiscordBot();

module.exports = client;

client.connect();

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

const db = require('./utils/EconomyDB');

const gracefulShutdown = () => {
    console.log('Received kill signal, shutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        client.destroy();
        process.exit(0);
    });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);