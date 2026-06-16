const db = require('./EconomyDB');

/**
 * Shared helpers for the casino minigames (slots, coinflip, ...).
 *
 * Wraps the economy DB in small promise-returning operations so the games stay
 * readable, keeps balance changes atomic (no double-spend races), and owns the
 * cross-game systems: lifetime gambling stats, the progressive jackpot pool and
 * restart-safe per-game cooldowns.
 */

const JACKPOT_SEED = 5000; // pool value after a jackpot is won

// ── Balance ─────────────────────────────────────────────────────────────────

/**
 * Atomically remove `amount` caps from a user, only if they can afford it.
 * @returns {Promise<boolean>} true if the caps were deducted, false if too poor.
 */
function placeBet(userId, amount) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE users SET balance = IFNULL(balance, 0) - ? WHERE id = ? AND IFNULL(balance, 0) >= ?',
            [amount, userId, amount],
            function (err) {
                if (err) return reject(err);
                resolve(this.changes > 0);
            }
        );
    });
}

/** Credit `amount` caps to a user, creating the row if needed. */
function credit(userId, amount) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('INSERT OR IGNORE INTO users (id, balance) VALUES (?, 0)', [userId]);
            db.run(
                'UPDATE users SET balance = IFNULL(balance, 0) + ? WHERE id = ?',
                [amount, userId],
                (err) => (err ? reject(err) : resolve())
            );
        });
    });
}

function getBalance(userId) {
    return new Promise((resolve) => {
        db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, row) => {
            resolve(row ? (row.balance ?? 0) : 0);
        });
    });
}

function getLuck(userId) {
    return new Promise((resolve) => {
        db.get('SELECT stat_luck FROM users WHERE id = ?', [userId], (err, row) => {
            resolve(row ? (row.stat_luck ?? 1) : 1);
        });
    });
}

// ── Lifetime stats ────────────────────────────────────────────────────────────

/**
 * Record the outcome of one gamble.
 * @param {string} userId
 * @param {{ wager: number, payout: number, jackpot?: boolean }} result
 *        `payout` is the gross caps returned to the player (0 on a loss).
 */
function recordResult(userId, { wager, payout, jackpot = false }) {
    const net = payout - wager;
    const won = Math.max(0, net);
    const lost = Math.max(0, -net);
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO gambling_stats
                (user_id, games_played, total_wagered, total_won, total_lost, biggest_win, jackpots)
             VALUES (?, 1, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id) DO UPDATE SET
                games_played  = games_played  + 1,
                total_wagered = total_wagered + excluded.total_wagered,
                total_won     = total_won     + excluded.total_won,
                total_lost    = total_lost    + excluded.total_lost,
                biggest_win   = MAX(biggest_win, excluded.biggest_win),
                jackpots      = jackpots      + excluded.jackpots`,
            [userId, wager, won, lost, won, jackpot ? 1 : 0],
            (err) => (err ? reject(err) : resolve())
        );
    });
}

function getStats(userId) {
    return new Promise((resolve) => {
        db.get('SELECT * FROM gambling_stats WHERE user_id = ?', [userId], (err, row) => {
            resolve(row || {
                games_played: 0, total_wagered: 0, total_won: 0,
                total_lost: 0, biggest_win: 0, jackpots: 0
            });
        });
    });
}

// ── Progressive jackpot ───────────────────────────────────────────────────────

function getJackpot() {
    return new Promise((resolve) => {
        db.get('SELECT jackpot FROM gamble_meta WHERE id = 1', [], (err, row) => {
            resolve(row ? row.jackpot : 0);
        });
    });
}

function addToJackpot(amount) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE gamble_meta SET jackpot = jackpot + ? WHERE id = 1', [Math.floor(amount)],
            (err) => (err ? reject(err) : resolve()));
    });
}

/** Read the current pool and reset it to the seed in one step; returns the pool that was won. */
function claimJackpot() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.get('SELECT jackpot FROM gamble_meta WHERE id = 1', [], (err, row) => {
                if (err) return reject(err);
                const pool = row ? row.jackpot : 0;
                db.run('UPDATE gamble_meta SET jackpot = ? WHERE id = 1', [JACKPOT_SEED],
                    (err2) => (err2 ? reject(err2) : resolve(pool)));
            });
        });
    });
}

// ── Cooldowns (restart-safe) ────────────────────────────────────────────────

/** @returns {Promise<number>} milliseconds remaining, or 0 if ready. */
function getCooldownRemaining(userId, game) {
    return new Promise((resolve) => {
        db.get('SELECT expires FROM gamble_cooldown WHERE user_id = ? AND game = ?', [userId, game], (err, row) => {
            if (!row) return resolve(0);
            const remaining = row.expires - Date.now();
            resolve(remaining > 0 ? remaining : 0);
        });
    });
}

function setCooldown(userId, game, durationMs) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO gamble_cooldown (user_id, game, expires) VALUES (?, ?, ?)
             ON CONFLICT(user_id, game) DO UPDATE SET expires = excluded.expires`,
            [userId, game, Date.now() + durationMs],
            (err) => (err ? reject(err) : resolve())
        );
    });
}

/** Format a millisecond duration as "1h 2m 3s" (trimmed to the largest two units). */
function formatDuration(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const parts = [];
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    if (s || parts.length === 0) parts.push(`${s}s`);
    return parts.slice(0, 2).join(' ');
}

module.exports = {
    JACKPOT_SEED,
    placeBet,
    credit,
    getBalance,
    getLuck,
    recordResult,
    getStats,
    getJackpot,
    addToJackpot,
    claimJackpot,
    getCooldownRemaining,
    setCooldown,
    formatDuration
};
