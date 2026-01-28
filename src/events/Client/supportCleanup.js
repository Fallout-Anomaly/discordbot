const { EmbedBuilder } = require('discord.js');
const Event = require("../../structure/Event");
const config = require("../../config");
const db = require("../../utils/EconomyDB");
const { error, info } = require("../../utils/Console");
const SupportUtil = require("../../utils/SupportUtil");

// Track interval to prevent duplicates on reload
let cleanupInterval = null;

module.exports = new Event({
    event: 'clientReady',
    run: async (client) => {
        // Initialize the support followups table
        await SupportUtil.initializeTable();

        // Prevent duplicate intervals
        if (cleanupInterval) {
            clearInterval(cleanupInterval);
        }

        // Prevent leaks on reload/exit
        process.on('beforeExit', () => {
            if (cleanupInterval) clearInterval(cleanupInterval);
        });

        // Run cleanup every 6 hours (21600000 ms)
        // Initial run after 5 minutes, then every 6 hours
        setTimeout(() => {
            runCleanupCycle(client);
            cleanupInterval = setInterval(() => runCleanupCycle(client), 6 * 60 * 60 * 1000);
        }, 5 * 60 * 1000);

        info('[SUPPORT CLEANUP] Automated cleanup scheduler initialized (runs every 6 hours)');
    }
}).toJSON();

async function runCleanupCycle(client) {
    info('[SUPPORT CLEANUP] Starting automated cleanup cycle...');
    const stats = await SupportUtil.runCleanupCycle(client);
    info(`[SUPPORT CLEANUP] Cycle complete: ${stats.scanned} scanned, ${stats.followups} followups, ${stats.closed} closed, ${stats.errors} errors`);
}


