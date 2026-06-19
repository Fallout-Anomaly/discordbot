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
        // lastNudge = -Infinity means "never nudged" — so the cooldown/window checks
        // treat a brand-new user as having last been nudged infinitely long ago
        // (i.e. not a repeat offender), regardless of the absolute clock value.
        r = { strikes: [], lastNudge: -Infinity, timeoutCount: 0 };
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

/**
 * Decide what to do about one detected support message, with a "warn first, strike
 * later" policy so a genuine help-seeker is never timed out for a burst of related
 * questions. The rules, in order:
 *
 *   1. Within the nudge cooldown of the *last* action → 'silent' (say nothing).
 *      This collapses a multi-message burst ("CTD", "crash to desktop", "help!")
 *      into a single response instead of one strike per line.
 *   2. First contact (no nudge inside the rolling window) → 'nudge', NO strike.
 *      A first-time asker always just gets the friendly "move to forum" button.
 *   3. They were already nudged earlier in the window → this is a genuine repeat.
 *      Accrue exactly ONE strike (never more than one per cooldown). If timeouts
 *      are off, or we're still below threshold → 'remind' (post the nudge again);
 *      once strikes reach the threshold → 'timeout'.
 *
 * Because a strike only accrues *after* a prior warning and at most once per
 * cooldown, reaching the timeout threshold requires the user to keep posting in
 * main chat across several spaced-out reminders — not a single confused flurry.
 *
 * @returns {{ action: 'silent'|'nudge'|'remind'|'timeout', strikeCount: number }}
 */
function evaluate(userId, opts, now = Date.now()) {
    const { cooldownMs, windowMs, threshold = 3, timeoutsEnabled = true } = opts;

    // Rule 1: still inside the cooldown since we last acted → stay quiet.
    if (!shouldNudge(userId, cooldownMs, now)) return { action: 'silent', strikeCount: 0 };

    // "Repeat" = we already nudged this user inside the rolling window.
    const isRepeat = !shouldNudge(userId, windowMs, now);
    markNudged(userId, now);

    // Rule 2: first contact in the window — warn only, no strike.
    if (!isRepeat) return { action: 'nudge', strikeCount: 0 };

    // Rule 3: genuine repeat. At most one strike per cooldown.
    if (!timeoutsEnabled) return { action: 'remind', strikeCount: 0 };
    const strikeCount = addStrike(userId, windowMs, now);
    return { action: strikeCount >= threshold ? 'timeout' : 'remind', strikeCount };
}

/** Test/maintenance helper. */
function reset(userId) {
    if (userId === undefined) records.clear();
    else records.delete(userId);
}

module.exports = { addStrike, clearStrikes, shouldNudge, markNudged, timeoutDurationMs, recordTimeout, evaluate, reset, _records: records };
