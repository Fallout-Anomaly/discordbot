const Event = require('../../structure/Event');
const DonorSystem = require('../../utils/DonorSystem');
const { Events } = require('discord.js');
const { info, error } = require('../../utils/Console');

module.exports = new Event({
    event: Events.ClientReady,
    once: false,
    run: (client) => {
        // Check every hour if it's a new month - award raffle entries
        if (global.raffleMonthlyInterval) clearInterval(global.raffleMonthlyInterval);

        global.raffleMonthlyInterval = setInterval(async () => {
            const now = new Date();
            const isFirstDay = now.getDate() === 1;
            const isFirstHour = now.getHours() === 0;

            // Only run on the first hour of the first day of the month
            if (!isFirstDay || !isFirstHour) return;

            // Idempotency guard: award at most once per month even across restarts
            // (the hourly tick can fire again within the 00:00 hour after a restart).
            const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
            try {
                if (client.database?.get && client.database.get('raffle_last_award_month') === monthKey) {
                    return; // already awarded this month
                }
            } catch { /* if the lookup fails, fall through and award */ }

            try {
                info('[RAFFLE] Monthly raffle entry award cycle starting...');

                // Get all donors
                const donors = await DonorSystem.getTopDonors(10000);
                const entriesToAward = [];

                for (const donor of donors) {
                    const tierInfo = DonorSystem.TIERS[donor.tier];
                    if (tierInfo && tierInfo.raffle_entries_per_month) {
                        entriesToAward.push({ 
                            userId: donor.user_id, 
                            count: tierInfo.raffle_entries_per_month 
                        });
                    }
                }

                if (entriesToAward.length > 0) {
                    await DonorSystem.batchAddRaffleEntries(entriesToAward);
                }

                // Clear expired raffle data (older than 3 months)
                await DonorSystem.clearExpiredRaffles();

                // Mark this month as awarded so a restart can't double-award.
                try { client.database?.set?.('raffle_last_award_month', monthKey); } catch { /* non-fatal */ }

                info(`[RAFFLE] Monthly cycle complete: ${entriesToAward.length} donors awarded raffle entries`);
            } catch (err) {
                error('[RAFFLE] Error in monthly cycle:', err);
            }
        }, 60 * 60 * 1000); // Check every hour

        info('[RAFFLE] Monthly raffle entry award system initialized');
    }
}).toJSON();
