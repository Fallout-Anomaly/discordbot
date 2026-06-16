const db = require('./EconomyDB');
const config = require('../config');

class DonorSystem {
    // Numeric perks per tier. Tier name/badge/colour stay in TIERS below; this
    // map is the single source of truth for the *gameplay* perks every command
    // reads via getPerks(). 'none' is the baseline for non-supporters.
    static PERKS = {
        none:     { daily_caps: 100, weekly_caps: 500,  gambling_max_bet_mult: 1, gambling_cooldown_mult: 1,    luck_bonus: 0, stash_interest_bonus: 0,     cooldown_reduction: 0,    faction_rep_mult: 1,    extra_daily_quests: 0 },
        bronze:   { daily_caps: 150, weekly_caps: 750,  gambling_max_bet_mult: 2, gambling_cooldown_mult: 0.85, luck_bonus: 1, stash_interest_bonus: 0.005, cooldown_reduction: 0.10, faction_rep_mult: 1.10, extra_daily_quests: 1 },
        silver:   { daily_caps: 225, weekly_caps: 1200, gambling_max_bet_mult: 3, gambling_cooldown_mult: 0.70, luck_bonus: 2, stash_interest_bonus: 0.010, cooldown_reduction: 0.20, faction_rep_mult: 1.20, extra_daily_quests: 1 },
        gold:     { daily_caps: 350, weekly_caps: 2000, gambling_max_bet_mult: 5, gambling_cooldown_mult: 0.50, luck_bonus: 3, stash_interest_bonus: 0.020, cooldown_reduction: 0.30, faction_rep_mult: 1.35, extra_daily_quests: 2 },
        platinum: { daily_caps: 600, weekly_caps: 4000, gambling_max_bet_mult: 10, gambling_cooldown_mult: 0.35, luck_bonus: 5, stash_interest_bonus: 0.035, cooldown_reduction: 0.40, faction_rep_mult: 1.50, extra_daily_quests: 3 }
    };

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
            // Upsert that PRESERVES joined_date and first_bonus_claimed on upgrade —
            // INSERT OR REPLACE would wipe them and let the welcome bonus be farmed.
            db.run(
                `INSERT INTO donors (user_id, tier, joined_date, custom_badge) VALUES (?, ?, ?, ?)
                 ON CONFLICT(user_id) DO UPDATE SET tier = excluded.tier, custom_badge = excluded.custom_badge`,
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
     * Batch add raffle entries for many users (Efficiency fix for 6.1)
     * @param {Array} entryArray - Array of {userId, count} objects
     */
    static batchAddRaffleEntries(entryArray) {
        if (!entryArray || entryArray.length === 0) return Promise.resolve();
        
        return new Promise((resolve, reject) => {
            const monthYear = new Date().toISOString().slice(0, 7);
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                const stmt = db.prepare(`INSERT INTO raffle_pool (user_id, entries, month_year) VALUES (?, ?, ?)`);
                entryArray.forEach(item => {
                    stmt.run(item.userId, item.count, monthYear);
                });
                stmt.finalize();
                db.run('COMMIT', (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        reject(err);
                    } else resolve();
                });
            });
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
     * Resolve a user's effective perk tier. An explicit donors-table entry wins;
     * otherwise a Discord role from config.donor.role_tier_map is used. This is
     * what unifies the role-based and table-based donor systems.
     * @param {string} userId
     * @param {import('discord.js').GuildMember} [member] optional, enables role fallback
     * @returns {Promise<string>} a key of PERKS ('none' | 'bronze' | ...)
     */
    static async getEffectiveTier(userId, member = null) {
        const donor = await this.getDonor(userId);
        if (donor && this.PERKS[donor.tier]) return donor.tier;

        if (member?.roles?.cache) {
            const map = config.donor?.role_tier_map || {};
            let best = null;
            const rank = { bronze: 1, silver: 2, gold: 3, platinum: 4 };
            for (const [roleId, tier] of Object.entries(map)) {
                if (member.roles.cache.has(roleId) && this.PERKS[tier]) {
                    if (!best || rank[tier] > rank[best]) best = tier;
                }
            }
            if (best) return best;
        }
        return 'none';
    }

    /**
     * Get the full numeric perk set for a user, with weekend bonuses already
     * applied to caps perks.
     * @returns {Promise<{tier:string, isSupporter:boolean} & typeof DonorSystem.PERKS.none>}
     */
    static async getPerks(userId, member = null) {
        const tier = await this.getEffectiveTier(userId, member);
        const base = { ...this.PERKS[tier] };
        if (this.isBonusWeekend()) {
            const mult = config.donor?.weekend_caps_multiplier || 1;
            base.daily_caps = Math.floor(base.daily_caps * mult);
            base.weekly_caps = Math.floor(base.weekly_caps * mult);
        }
        return { tier, isSupporter: tier !== 'none', ...base };
    }

    /** True when weekend perk-boost is enabled and it's Sat/Sun (server local time). */
    static isBonusWeekend() {
        if (!config.donor?.double_perk_weekends) return false;
        const day = new Date().getDay(); // 0 = Sun, 6 = Sat
        return day === 0 || day === 6;
    }

    /** Internal: credit caps to a user, creating the row if needed. */
    static creditCaps(userId, amount) {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('INSERT OR IGNORE INTO users (id, balance) VALUES (?, 0)', [userId]);
                db.run('UPDATE users SET balance = IFNULL(balance, 0) + ? WHERE id = ?', [amount, userId],
                    (err) => (err ? reject(err) : resolve()));
            });
        });
    }

    /** Has this user already been referred by someone? */
    static hasBeenReferred(referredId) {
        return new Promise((resolve) => {
            db.get('SELECT 1 FROM referrals WHERE referred_id = ? LIMIT 1', [referredId], (err, row) => {
                resolve(!!row);
            });
        });
    }

    /**
     * Process a referral claim: records it, pays both parties and grants the
     * referrer a raffle entry. Caller is responsible for join-window / self-refer
     * validation. Returns the reward amounts that were granted.
     */
    static async processReferral(referrerId, referredId) {
        const c = config.donor || {};
        const referrerCaps = c.referral_referrer_caps ?? 300;
        const referredCaps = c.referral_referred_caps ?? 200;
        const raffleEntries = c.referral_referrer_raffle_entries ?? 1;

        await this.recordReferral(referrerId, referredId);
        await this.creditCaps(referrerId, referrerCaps);
        await this.creditCaps(referredId, referredCaps);
        if (raffleEntries > 0) await this.addRaffleEntries(referrerId, raffleEntries);

        return { referrerCaps, referredCaps, raffleEntries };
    }

    /**
     * Grant the one-time first-donation welcome bonus if not already claimed.
     * The UPDATE only matches when the flag is still 0, so this.changes tells us
     * whether we just claimed it — no read-then-write race.
     * @returns {Promise<number>} caps granted (0 if already claimed / disabled)
     */
    static grantFirstDonationBonus(userId) {
        const amount = config.donor?.first_donation_bonus_caps ?? 0;
        return new Promise((resolve, reject) => {
            if (amount <= 0) return resolve(0);
            const self = this;
            db.run(
                'UPDATE donors SET first_bonus_claimed = 1 WHERE user_id = ? AND IFNULL(first_bonus_claimed, 0) = 0',
                [userId],
                function (err) {
                    if (err) return reject(err);
                    if (this.changes === 0) return resolve(0); // already claimed or no donor row
                    self.creditCaps(userId, amount).then(() => resolve(amount)).catch(reject);
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
