const db = require('./EconomyDB');

class DonorSystem {
    // Donor Tiers and their perks
    static TIERS = {
        bronze: {
            name: 'Bronze Supporter',
            badge: '🥉',
            xp_multiplier: 1.15,
            raffle_entries_per_month: 2,
            color: '#CD7F32'
        },
        silver: {
            name: 'Silver Supporter',
            badge: '🥈',
            xp_multiplier: 1.3,
            raffle_entries_per_month: 5,
            color: '#C0C0C0'
        },
        gold: {
            name: 'Gold Supporter',
            badge: '🏅',
            xp_multiplier: 1.5,
            raffle_entries_per_month: 10,
            color: '#FFD700'
        },
        platinum: {
            name: 'Platinum Supporter',
            badge: '💎',
            xp_multiplier: 2.0,
            raffle_entries_per_month: 25,
            color: '#E5E4E2'
        }
    };

    /**
     * Add or upgrade a donor
     */
    static addDonor(userId, tier = 'bronze', customBadge = '') {
        return new Promise((resolve, reject) => {
            const joinedDate = Date.now();
            db.run(
                `INSERT OR REPLACE INTO donors (user_id, tier, joined_date, custom_badge) VALUES (?, ?, ?, ?)`,
                [userId, tier, joinedDate, customBadge],
                function(err) {
                    if (err) reject(err);
                    else resolve({ userId, tier, joinedDate });
                }
            );
        });
    }

    /**
     * Get donor info
     */
    static getDonor(userId) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM donors WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }

    /**
     * Check if user is a donor
     */
    static async isDonor(userId) {
        const donor = await this.getDonor(userId);
        return donor !== null;
    }

    /**
     * Get XP multiplier for a donor
     */
    static async getXpMultiplier(userId) {
        const donor = await this.getDonor(userId);
        if (!donor || !this.TIERS[donor.tier]) return 1.0;
        return this.TIERS[donor.tier].xp_multiplier;
    }

    /**
     * Get donor badge string
     */
    static async getDonorBadge(userId) {
        const donor = await this.getDonor(userId);
        if (!donor) return '';
        
        if (donor.custom_badge) return donor.custom_badge;
        
        const tier = this.TIERS[donor.tier];
        return tier ? `${tier.badge} ${tier.name}` : '';
    }

    /**
     * Add raffle entries for a donor
     */
    static addRaffleEntries(userId, count = 1) {
        return new Promise((resolve, reject) => {
            const monthYear = new Date().toISOString().slice(0, 7); // YYYY-MM
            db.run(
                `INSERT INTO raffle_pool (user_id, entries, month_year) VALUES (?, ?, ?)`,
                [userId, count, monthYear],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    /**
     * Get raffle entries for current month
     */
    static getRaffleEntries(userId) {
        return new Promise((resolve, reject) => {
            const monthYear = new Date().toISOString().slice(0, 7);
            db.get(
                `SELECT SUM(entries) as total FROM raffle_pool WHERE user_id = ? AND month_year = ?`,
                [userId, monthYear],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.total || 0);
                }
            );
        });
    }

    /**
     * Pick a random raffle winner
     */
    static pickRaffleWinner() {
        return new Promise((resolve, reject) => {
            const monthYear = new Date().toISOString().slice(0, 7);
            
            // Get all entries with weighted probability
            db.all(
                `SELECT user_id, SUM(entries) as total_entries FROM raffle_pool WHERE month_year = ? GROUP BY user_id`,
                [monthYear],
                (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    if (!rows || rows.length === 0) {
                        resolve(null);
                        return;
                    }
                    
                    // Weight the selection
                    let totalEntries = 0;
                    rows.forEach(r => totalEntries += r.total_entries);
                    
                    const random = Math.random() * totalEntries;
                    let accumulated = 0;
                    
                    for (const row of rows) {
                        accumulated += row.total_entries;
                        if (random <= accumulated) {
                            resolve(row.user_id);
                            return;
                        }
                    }
                    
                    resolve(rows[0].user_id);
                }
            );
        });
    }

    /**
     * Clear raffle pool for a new month
     */
    static clearExpiredRaffles() {
        return new Promise((resolve, reject) => {
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            const cutoffDate = threeMonthsAgo.toISOString().slice(0, 7);
            
            db.run(
                `DELETE FROM raffle_pool WHERE month_year < ?`,
                [cutoffDate],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    /**
     * Get top donors (leaderboard)
     */
    static getTopDonors(limit = 10) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT user_id, tier, joined_date FROM donors ORDER BY 
                    CASE tier 
                        WHEN 'platinum' THEN 4 
                        WHEN 'gold' THEN 3 
                        WHEN 'silver' THEN 2 
                        WHEN 'bronze' THEN 1 
                    END DESC, joined_date ASC LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    /**
     * Record a referral
     */
    static recordReferral(referrerId, referredId) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT OR IGNORE INTO referrals (referrer_id, referred_id, join_date) VALUES (?, ?, ?)`,
                [referrerId, referredId, Date.now()],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    /**
     * Get referral count for a user
     */
    static getReferralCount(userId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.count || 0);
                }
            );
        });
    }

    /**
     * Remove donor status
     */
    static removeDonor(userId) {
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM donors WHERE user_id = ?`,
                [userId],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }
}

module.exports = DonorSystem;
