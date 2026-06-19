// Run with: bun test src/utils/SupportStrikes.test.js
const { test, expect, describe, beforeEach } = require('bun:test');
const strikes = require('./SupportStrikes');

const U = 'user-1';
const MIN = 60000;

beforeEach(() => strikes.reset());

describe('addStrike + window', () => {
    test('counts strikes inside the window', () => {
        const t0 = 1_000_000;
        expect(strikes.addStrike(U, 60 * MIN, t0)).toBe(1);
        expect(strikes.addStrike(U, 60 * MIN, t0 + 5 * MIN)).toBe(2);
        expect(strikes.addStrike(U, 60 * MIN, t0 + 10 * MIN)).toBe(3);
    });

    test('strikes older than the window fall off', () => {
        const t0 = 1_000_000;
        strikes.addStrike(U, 60 * MIN, t0);
        strikes.addStrike(U, 60 * MIN, t0 + 5 * MIN);
        // 90 minutes later, both earlier strikes have expired → count resets to 1
        expect(strikes.addStrike(U, 60 * MIN, t0 + 90 * MIN)).toBe(1);
    });

    test('clearStrikes forgives the user', () => {
        const t0 = 1_000_000;
        strikes.addStrike(U, 60 * MIN, t0);
        strikes.addStrike(U, 60 * MIN, t0 + 1 * MIN);
        strikes.clearStrikes(U);
        expect(strikes.addStrike(U, 60 * MIN, t0 + 2 * MIN)).toBe(1);
    });
});

describe('nudge cooldown', () => {
    test('blocks within cooldown, allows after', () => {
        const t0 = 1_000_000;
        expect(strikes.shouldNudge(U, 10 * MIN, t0)).toBe(true);
        strikes.markNudged(U, t0);
        expect(strikes.shouldNudge(U, 10 * MIN, t0 + 5 * MIN)).toBe(false);
        expect(strikes.shouldNudge(U, 10 * MIN, t0 + 11 * MIN)).toBe(true);
    });
});

describe('timeout escalation', () => {
    test('timeoutDurationMs is pure — no escalation without recordTimeout', () => {
        const base = 10 * MIN;
        const max = 60 * MIN;
        // Repeated peeks without committing must NOT escalate.
        expect(strikes.timeoutDurationMs(U, base, max, true)).toBe(10 * MIN);
        expect(strikes.timeoutDurationMs(U, base, max, true)).toBe(10 * MIN);
    });

    test('doubles each time recordTimeout is called, capped at max', () => {
        const base = 10 * MIN;
        const max = 60 * MIN;
        const step = () => { const d = strikes.timeoutDurationMs(U, base, max, true); strikes.recordTimeout(U); return d; };
        expect(step()).toBe(10 * MIN); // 1st
        expect(step()).toBe(20 * MIN); // 2nd
        expect(step()).toBe(40 * MIN); // 3rd
        expect(step()).toBe(60 * MIN); // 4th -> capped
        expect(step()).toBe(60 * MIN); // stays capped
    });

    test('escalate=false keeps a flat duration', () => {
        const base = 10 * MIN;
        const max = 1440 * MIN;
        strikes.recordTimeout(U);
        strikes.recordTimeout(U);
        expect(strikes.timeoutDurationMs(U, base, max, false)).toBe(10 * MIN);
    });
});

describe('evaluate — warn first, strike later', () => {
    const opts = { cooldownMs: 10 * MIN, windowMs: 60 * MIN, threshold: 3, timeoutsEnabled: true };

    test('first contact only nudges — never a strike', () => {
        const t0 = 1_000_000;
        const r = strikes.evaluate(U, opts, t0);
        expect(r.action).toBe('nudge');
        expect(r.strikeCount).toBe(0);
    });

    test('a burst within the cooldown stays silent (one response per burst)', () => {
        const t0 = 1_000_000;
        expect(strikes.evaluate(U, opts, t0).action).toBe('nudge');
        // Three more messages seconds/minutes apart, all inside the 10-min cooldown.
        expect(strikes.evaluate(U, opts, t0 + 1000).action).toBe('silent');
        expect(strikes.evaluate(U, opts, t0 + 2 * MIN).action).toBe('silent');
        expect(strikes.evaluate(U, opts, t0 + 9 * MIN).action).toBe('silent');
    });

    test('spaced repeats accrue one strike each, then time out at threshold', () => {
        const t0 = 1_000_000;
        // 1st: nudge, no strike.
        expect(strikes.evaluate(U, opts, t0).action).toBe('nudge');
        // 2nd repeat (past cooldown, still in window): strike 1 → remind.
        let r = strikes.evaluate(U, opts, t0 + 11 * MIN);
        expect(r.action).toBe('remind');
        expect(r.strikeCount).toBe(1);
        // 3rd repeat: strike 2 → remind.
        r = strikes.evaluate(U, opts, t0 + 22 * MIN);
        expect(r.action).toBe('remind');
        expect(r.strikeCount).toBe(2);
        // 4th repeat: strike 3 → timeout.
        r = strikes.evaluate(U, opts, t0 + 33 * MIN);
        expect(r.action).toBe('timeout');
        expect(r.strikeCount).toBe(3);
    });

    test('a single confused flurry of 5 messages never reaches a timeout', () => {
        const t0 = 1_000_000;
        const actions = [0, 30_000, 60_000, 90_000, 120_000].map((dt) => strikes.evaluate(U, opts, t0 + dt).action);
        expect(actions).toEqual(['nudge', 'silent', 'silent', 'silent', 'silent']);
    });

    test('clearStrikes after a move forgives accrued strikes', () => {
        const t0 = 1_000_000;
        strikes.evaluate(U, opts, t0);                       // nudge
        expect(strikes.evaluate(U, opts, t0 + 11 * MIN).strikeCount).toBe(1);
        strikes.clearStrikes(U);                             // user moved their post
        // Next spaced repeat starts counting from zero again.
        expect(strikes.evaluate(U, opts, t0 + 22 * MIN).strikeCount).toBe(1);
    });

    test('timeoutsEnabled=false reminds forever, never times out', () => {
        const t0 = 1_000_000;
        const off = { ...opts, timeoutsEnabled: false };
        expect(strikes.evaluate(U, off, t0).action).toBe('nudge');
        for (let i = 1; i <= 5; i++) {
            const r = strikes.evaluate(U, off, t0 + i * 11 * MIN);
            expect(r.action).toBe('remind');
            expect(r.strikeCount).toBe(0);
        }
    });

    test('once the window lapses, a returning user is treated as first contact again', () => {
        const t0 = 1_000_000;
        expect(strikes.evaluate(U, opts, t0).action).toBe('nudge');
        // 90 minutes later — past the 60-min window → nudge, not a strike.
        const r = strikes.evaluate(U, opts, t0 + 90 * MIN);
        expect(r.action).toBe('nudge');
        expect(r.strikeCount).toBe(0);
    });
});
