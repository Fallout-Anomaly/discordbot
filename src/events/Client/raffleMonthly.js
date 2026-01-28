const Event = require('../../structure/Event');
const DonorSystem = require('../../utils/DonorSystem');
const { Events } = require('discord.js');

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

            try {
                console.log('[RAFFLE] Monthly raffle entry award cycle starting...');

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

                console.log(`[RAFFLE] Monthly cycle complete: ${entriesToAward.length} donors awarded raffle entries`);
            } catch (err) {
                console.error('[RAFFLE] Error in monthly cycle:', err);
            }
        }, 60 * 60 * 1000); // Check every hour

        console.log('[RAFFLE] Monthly raffle entry award system initialized');
    }
}).toJSON();
