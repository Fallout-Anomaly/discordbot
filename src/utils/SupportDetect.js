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
    "won't load", 'wont load', "won't open", 'wont open', 'glitch', 'glitched', 'bug', 'broken'
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

// Question openers — message that begins like a question.
const QUESTION_OPENERS = [
    'how', 'why', 'what', 'where', 'when', 'which', 'can', 'could', 'should', 'is',
    'are', 'does', 'do', 'did', 'anyone', 'anybody', 'has anyone', 'help'
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

    // Signal 3: looks like a question AND mentions something technical.
    const isQuestion = text.includes('?') || QUESTION_OPENERS.some((w) => words[0] === w);
    if (isQuestion && hasTech) {
        reasons.push('question+tech');
    }

    return { match: reasons.length > 0, reasons };
}

module.exports = { looksLikeSupportRequest, STRONG_PHRASES, AMBIGUOUS_PHRASES, TECH_KEYWORDS };
