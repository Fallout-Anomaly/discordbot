// Run with: bun test src/utils/SupportDetect.test.js
const { test, expect, describe } = require('bun:test');
const { looksLikeSupportRequest } = require('./SupportDetect');

describe('looksLikeSupportRequest — should fire (belongs in forum)', () => {
    const positives = [
        'my game keeps crashing when I enter Diamond City, any help?',
        'CTD on launch after installing the modlist',
        "fallout 4 won't launch with f4se, what do I do",
        'how do I fix a missing master error in MO2?',
        'infinite loading screen when I load my save',
        'anyone know why my load order is broken after the update?',
        'wabbajack error failed to download a mod, help please',
        'the game freezes on the main menu after a fresh install',  // ambiguous(freezes)+tech(game/install)
        'my mod is broken after the last update',                   // ambiguous(broken)+tech(mod/update)
        // Canonical short support phrases must fire even below the length/word floor.
        'CTD',
        'ctd',
        'Crash to desktop',
        'crashes to desktop',
        'need help',
        // Symptom phrasings + tech context (real misses reported from main chat).
        "I'm stuck on black, nothing is loading and I can't start a new game",
        'fresh reinstall and the same problem with MO2',
        "can't launch the game after the last update",
        'nothing loads in MO2 anymore',
        // The full multi-line message that slipped past the detector in #chat.
        "Okay so I did a fresh reinstall, everything is new, I didn't download anything else, and yet the same problem persists\n" +
        "I'm stuck on black\nNothing is loading\nI can't start a new game\nAt all\n" +
        "I don't know what is happening to have caused this\n" +
        "I don't know if it's a problem with the mods or with the launcher or with MO2\n" +
        "It was working perfectly before the update, now I can't even play"
    ];
    for (const msg of positives) {
        test(JSON.stringify(msg), () => {
            expect(looksLikeSupportRequest(msg).match).toBe(true);
        });
    }
});

describe('looksLikeSupportRequest — should NOT fire (casual chat)', () => {
    const negatives = [
        'gg that was a great raid last night',
        'lol nice',
        'good morning everyone',
        'what time is the stream today?',          // question, but no tech keyword
        'this mod is amazing, love the new weapons', // tech word, but not a question/help
        'hi',
        'https://nexusmods.com/fallout4/mods/123',   // basically just a link
        'anyone want to play co-op later?',
        "it's freezing outside today brr",            // ambiguous word, no tech
        'my brain is not working today lol',          // ambiguous word, no tech
        'i crashed at like 2am last night',           // ambiguous word, no tech
        'that strat is broken, so op',                // ambiguous word, no tech
        'Crashing',                                   // bare ambiguous word, no tech — deliberately too vague to fire
        "i'm stuck on this puzzle lol",               // 'stuck on' but no tech keyword
        "can't play tonight, maybe tomorrow",         // 'can't play' but no tech keyword
        'we have the same problem with the weather'   // 'same problem' but no tech keyword
    ];
    for (const msg of negatives) {
        test(JSON.stringify(msg), () => {
            expect(looksLikeSupportRequest(msg).match).toBe(false);
        });
    }
});

describe('options', () => {
    test('respects extraKeywords', () => {
        expect(looksLikeSupportRequest('the bunker door is glitched', { extraKeywords: ['bunker door'] }).match).toBe(true);
        expect(looksLikeSupportRequest('the bunker door is glitched').match).toBe(false);
    });
    test('non-string input is safe', () => {
        expect(looksLikeSupportRequest(null).match).toBe(false);
        expect(looksLikeSupportRequest(undefined).match).toBe(false);
    });
});
