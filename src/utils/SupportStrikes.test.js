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
