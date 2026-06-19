// In-memory strike tracker for the support-deflection system. Tracks, per user:
//   - strikes: timestamps of support messages posted in main chat (rolling window)
//   - lastNudge: when we last posted a "move to forum" nudge (for cooldown)
//   - timeoutCount: how many times we've already timed this user out (for escalation)
//
// State is process-local and intentionally not persisted — strikes should decay,
// and a bot restart is a reasonable "clean slate." All time math takes an
// injectable `now` so the logic is unit-testable without real clocks.

const records = new Map(); // userId -> { strikes: number[], lastNudge: number, timeoutCount: number }

function _rec(userId) {
    let r = records.get(userId);
    if (!r) {
        r = { strikes: [], lastNudge: 0, timeoutCount: 0 };
        records.set(userId, r);
    }
    return r;
}

/**
 * Record one support-style message and return how many strikes fall inside the window.
 */
function addStrike(userId, windowMs, now = Date.now()) {
    const r = _rec(userId);
    r.strikes = r.strikes.filter((t) => now - t < windowMs);
    r.strikes.push(now);
    return r.strikes.length;
}

/** Forgive a user (e.g. they actually moved their message to the forum). */
function clearStrikes(userId) {
    const r = records.get(userId);
    if (r) r.strikes = [];
}

/** Cooldown gate so the same person isn't nudged on every message. */
function shouldNudge(userId, cooldownMs, now = Date.now()) {
    return now - _rec(userId).lastNudge >= cooldownMs;
}

function markNudged(userId, now = Date.now()) {
    _rec(userId).lastNudge = now;
}

/**
 * Compute what the next timeout duration (ms) WOULD be, without mutating state.
 * With escalate=true, each subsequent timeout doubles the base, capped at maxMs.
 * Call recordTimeout() only after the timeout actually succeeds.
 */
function timeoutDurationMs(userId, baseMs, maxMs, escalate = true) {
    const r = _rec(userId);
    const multiplier = escalate ? Math.pow(2, r.timeoutCount) : 1;
    return Math.min(baseMs * multiplier, maxMs);
}

/** Advance the escalation counter — only after a timeout was actually applied. */
function recordTimeout(userId) {
    _rec(userId).timeoutCount += 1;
}

/** Test/maintenance helper. */
function reset(userId) {
    if (userId === undefined) records.clear();
    else records.delete(userId);
}

module.exports = { addStrike, clearStrikes, shouldNudge, markNudged, timeoutDurationMs, recordTimeout, reset, _records: records };
