// Heuristic detector for "this looks like a support request that belongs in the
// support forum, not the main chat channel." Kept as a pure function (no Discord
// objects) so it can be unit-tested in isolation — see SupportDetect.test.js.
//
// Philosophy: main chat is casual, so a false positive (nagging someone who was
// just chatting) is worse than a false negative. We only fire when the message
// is either an explicit help signal, or a question that also mentions something
// technical. Everything is tunable from config.moderation.support_deflect.

// Strong signals — unambiguous in a modlist support context. Any one is enough.
const STRONG_PHRASES = [
    "won't launch", 'wont launch', "won't start", 'wont start',
    "won't install", 'wont install', "won't run", 'wont run',
    'ctd', 'crash to desktop', 'crashes to desktop', 'crashing to desktop',
    'keeps crashing', 'crash log', 'crashlog', 'buffout',
    'infinite load', 'infinite loading', 'stuck on load', 'stuck loading', 'stuck on the load',
    'black screen', 'blue screen',
    'load order', 'missing master', 'missing masters', 'missing plugin', 'missing esp', 'missing esm',
    'need help', 'need some help', 'help please', 'please help', 'any help',
    'how do i fix', 'how to fix', 'how do i install', 'how to install',
    'wabbajack error', 'failed to install', 'failed to download', 'install failed', 'download failed'
];

// Ambiguous in casual chat ("freezing outside", "crashed at 2am", "not working today").
// These only count as support when a technical word is also present.
const AMBIGUOUS_PHRASES = [
    'crash', 'crashing', 'crashed', 'freezing', 'freezes', 'frozen',
    'not working', "doesn't work", 'doesnt work', "won't work", 'wont work',
    "won't load", 'wont load', "won't open", 'wont open', 'glitch', 'glitched', 'bug', 'broken',
    // Symptom phrasings people actually use to describe a broken modlist/launcher.
    // Still gated behind a tech keyword, so casual use ("stuck on this puzzle",
    // "can't play tonight") won't fire unless the game/mods are also mentioned.
    'stuck on', 'stuck at', 'stuck loading', 'black screen', 'on black',
    'not loading', 'nothing loads', 'nothing is loading', 'wont load', "won't even", 'wont even',
    "can't even", 'cant even', "can't start", 'cant start', "can't launch", 'cant launch',
    "can't play", 'cant play', "can't run", 'cant run', "can't load", 'cant load',
    'reinstall', 'reinstalled', 'fresh install', 'stopped working', 'no longer works', 'same problem'
];

// Words that signal the message is about the modlist / tooling (the "technical" gate).
const TECH_KEYWORDS = [
    'mo2', 'mod organizer', 'vortex', 'wabbajack', 'f4se', 'fose', 'script extender',
    'mod', 'mods', 'modlist', 'load order', 'plugin', 'plugins', 'esp', 'esm', 'esl',
    'install', 'installing', 'installed', 'download', 'downloading', 'update', 'updating',
    'fallout', 'fo4', 'fo3', 'nv', 'new vegas', 'skyrim', 'game', 'save', 'savegame',
    'ini', '.ini', 'nexus', 'patch', 'mesh', 'texture', 'ba2', 'archive', 'launcher',
    'crash log', 'crashlog', 'buffout', 'error code', 'gpu', 'driver', 'enb', 'reshade'
];

// Help-seeking question phrasings. A bare "?" next to a tech word is NOT enough —
// "how's your experience with this mod?" / "is this one any good?" are casual chat.
// We only treat a question as support when it's phrased as someone asking for help
// or describing something going wrong (not asking for opinions).
const HELP_PHRASES = [
    'how do i', 'how to', 'how can i', 'how would i',
    'how do you fix', 'how do you install', 'how do you get', 'how do you make',
    'where do i', 'where can i', 'where is the', 'where are the',
    "why won't", 'why wont', "why isn't", 'why isnt', "why doesn't", 'why doesnt',
    'why does my', 'why is my', 'why are my', 'why did my', "why can't my", 'why cant my',
    'what do i do', "what's wrong", 'whats wrong', 'what causes', 'what am i doing wrong', 'what did i do wrong',
    'is there a way', 'is there any way', 'any way to fix', 'any fix for',
    'any idea why', 'anyone know how', 'anyone know why', 'does anyone know how', 'does anyone know why',
    'do i need to', 'help with', 'trouble with', 'issue with', 'issues with', 'problem with', 'problems with',
    "can't figure", 'cant figure', 'not sure how', 'not sure why'
];

const includesAny = (haystack, needles) => needles.some((n) => haystack.includes(n));

/**
 * @param {string} content   raw message content
 * @param {object} [opts]
 * @param {number} [opts.minLength=12]      ignore very short messages
 * @param {number} [opts.minWords=3]        ignore very short messages (word count)
 * @param {string[]} [opts.extraKeywords]   server-specific strong phrases to also catch
 * @returns {{ match: boolean, reasons: string[] }}
 */
function looksLikeSupportRequest(content, opts = {}) {
    const minLength = opts.minLength ?? 12;
    const minWords = opts.minWords ?? 3;
    const reasons = [];

    if (typeof content !== 'string') return { match: false, reasons };

    const text = content.toLowerCase().trim();

    const strongList = STRONG_PHRASES.concat(
        (opts.extraKeywords || []).map((k) => String(k).toLowerCase())
    );

    // Signal 1: an explicit strong phrase. These are unambiguous in a modlist
    // support context (e.g. "CTD", "crash to desktop", "need help"), so they fire
    // even on terse messages that fall below the casual-chat length/word floor.
    if (includesAny(text, strongList)) {
        return { match: true, reasons: ['strong-phrase'] };
    }

    // Everything below is an *ambiguous* signal that could just be normal chatter,
    // so it's gated behind a minimum length/word count (and link-only messages are
    // ignored) to avoid nagging casual conversation.
    if (text.length < minLength) return { match: false, reasons };

    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < minWords) return { match: false, reasons };

    const stripped = text.replace(/https?:\/\/\S+/g, '').trim();
    if (stripped.length < minLength) return { match: false, reasons };

    const hasTech = includesAny(text, TECH_KEYWORDS);

    // Signal 2: an ambiguous symptom word, but only alongside something technical.
    if (hasTech && includesAny(text, AMBIGUOUS_PHRASES)) {
        reasons.push('ambiguous+tech');
    }

    // Signal 3: a help-seeking question that also mentions something technical.
    // Requires explicit "asking for help / something's wrong" phrasing (not just a
    // "?") so casual questions about a mod — "how's your experience with it?",
    // "is this one any good?" — don't get nagged.
    if (includesAny(text, HELP_PHRASES) && hasTech) {
        reasons.push('help-question+tech');
    }

    return { match: reasons.length > 0, reasons };
}

module.exports = { looksLikeSupportRequest, STRONG_PHRASES, AMBIGUOUS_PHRASES, TECH_KEYWORDS };
