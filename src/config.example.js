// ─────────────────────────────────────────────────────────────────────────────
// CONFIG TEMPLATE
//
// `src/config.js` is gitignored (it holds your server's IDs). Copy this file to
// `src/config.js` and replace every YOUR_* placeholder with real Discord IDs.
// Secrets (bot token, API keys, channel/role IDs used by features) live in `.env`.
//
//   cp src/config.example.js src/config.js
// ─────────────────────────────────────────────────────────────────────────────

const config = {
    database: {
        path: './database.yml', // QuickYAML key/value store path
        knowledge: './knowledge' // Knowledge base directory (AI assistant)
    },
    development: {
        enabled: true,                 // Register commands to a single guild while testing
        guildId: 'YOUR_DEV_GUILD_ID'
    },
    channels: {
        auto_response: ['YOUR_MAIN_CHAT_CHANNEL_ID'], // Channels the auto-responder watches
        forum_support: ['YOUR_SUPPORT_FORUM_CHANNEL_ID'], // Forum channels the AI helper monitors
        no_staff_mention: ['YOUR_CHANNEL_ID'] // Channels where the AI must not ping staff
    },
    commands: {
        prefix: '!', // Message-command prefix
        message_commands: true,
        application_commands: {
            chat_input: true,
            user_context: true,
            message_context: true
        }
    },
    users: {
        ownerId: 'YOUR_OWNER_USER_ID',           // Bot owner (full access: eval, etc.)
        developers: ['YOUR_OWNER_USER_ID'],      // Bot developers (developer-only commands)
        // Discord roles used for legacy perk checks
        donator_role: 'YOUR_DONATOR_ROLE_ID',    // High tier
        booster_role: 'YOUR_BOOSTER_ROLE_ID'     // Mid tier
    },
    // Supporter / donor system (see src/utils/DonorSystem.js).
    // If this block is missing, the donor system degrades gracefully (no role→tier
    // mapping, default reward amounts, no first-donation bonus).
    donor: {
        // Map Discord roles to a perk tier for users without an explicit donors-table entry.
        // Values must be one of: bronze | silver | gold | platinum
        role_tier_map: {
            'YOUR_DONATOR_ROLE_ID': 'gold',
            'YOUR_BOOSTER_ROLE_ID': 'silver'
        },
        // Boost caps-based perks (daily/weekly) on weekends.
        double_perk_weekends: true,
        weekend_caps_multiplier: 2,
        // Referral rewards (caps) — /refer
        referral_referrer_caps: 300,
        referral_referred_caps: 200,
        referral_referrer_raffle_entries: 1,
        referral_window_days: 14,        // days after joining a member may claim a referrer
        // One-time welcome bonus granted the first time a user becomes a donor (caps)
        first_donation_bonus_caps: 1000,
        // Community donation goal shown by /donate (update manually)
        goal_label: 'Monthly Server Costs',
        goal_current: 0,
        goal_target: 100,
        donate_url: 'https://ko-fi.com/YOUR_PAGE'
    },
    roles: {
        staff_role: process.env.STAFF_ROLE_ID || 'YOUR_STAFF_ROLE_ID' // Escalation / trusted role
    },
    // FalloutChat in-game WebSocket relay (see src/utils/ChatRelay.js).
    // Bridges a Discord channel with the game chat server. All values come from
    // .env. If this block is missing the relay simply stays off.
    chat_relay: {
        enabled: process.env.CHAT_RELAY_ENABLED !== 'false',
        ws_url: process.env.CHAT_WS_URL || 'wss://your-chat-server.example/ws',
        channel_id: process.env.CHAT_RELAY_CHANNEL_ID || '', // Discord channel to mirror
        bot_secret: process.env.CHAT_BOT_SECRET || '',       // shared secret with the chat server
        // Role allowed to run relay moderation commands (plus devs / Ban Members perm).
        admin_role_id: process.env.CHAT_ADMIN_ROLE_ID || process.env.STAFF_ROLE_ID || ''
    },
    moderation: {
        scam_guard: {
            enabled: true,
            monitorChannels: [],   // empty = all channels
            ignoreChannels: [],
            trustedRoles: [],
            deleteAttachments: false,
            blockNewAccountAttachments: true,
            minAccountAgeDays: 7,
            minJoinAgeDays: 1,
            notifyUser: true
        },
        // Honeypot: a "do not post here" trap channel that auto-bans accounts which post in it
        // (catches spam/raider bots). Staff, the bot owner, and Ban-Members/Administrator are exempt.
        // Leave channelId empty to disable. See src/events/Client/honeypot.js.
        honeypot: {
            enabled: false,
            channelId: '',           // the trap channel's ID
            // Only ban accounts below these ages (the "new/suspicious" gate). 0 = no age limit (ban anyone non-staff).
            minAccountAgeDays: 7,
            minJoinAgeDays: 1,
            deleteMessageDays: 7,    // purge the banned user's recent messages (max 7)
            trustedRoles: []
        },
        // Support deflection: when a message in the main chat looks like a support
        // request, the bot replies with a "Move to support forum" button. One click
        // recreates the message as a forum post, pings the author there, and removes
        // the original. See src/events/Client/supportDeflect.js + components/Button/supportMove.js.
        support_deflect: {
            enabled: false,
            monitorChannels: [],     // channels to watch; empty = reuse channels.auto_response
            forumChannelId: '',      // target support forum; empty = first channels.forum_support entry
            defaultTagId: '',        // optional forum tag ID applied to moved posts (set if your forum requires a tag)
            trustedRoles: [],        // these roles (plus staff/admins) are never nudged
            cooldownSeconds: 600,    // per-user, so the same person isn't nagged repeatedly
            minLength: 12,           // ignore very short messages
            extraKeywords: [],       // server-specific phrases that should always count as support
            deleteOriginal: true,    // remove the main-chat message after moving it
            aiAnswer: true,          // post a first-pass AI answer (knowledge base + Groq) in the moved thread
            // Repeat offenders: each detected support message in main chat is a "strike."
            // Enough strikes inside the window earns an (escalating) timeout. Moving a
            // message via the button forgives all strikes. Needs the bot to have the
            // "Moderate Members" permission and a role above the offender.
            repeatOffender: {
                enabled: true,
                windowMinutes: 60,        // rolling window strikes are counted in
                strikesBeforeTimeout: 3,  // strikes within the window before a timeout
                timeoutMinutes: 10,       // base timeout length
                escalate: true,           // double the length each subsequent timeout...
                maxTimeoutMinutes: 1440,  // ...capped here (Discord hard max is 28 days)
                notifyChannelId: ''       // log channel; empty = LOGS_CHANNEL_ID env (or no log)
            }
        }
    },
    messages: { // Standard permission/cooldown responses used by the command handlers.
        NOT_BOT_OWNER: 'You do not have the permission to run this command because you\'re not the owner of me!',
        NOT_BOT_DEVELOPER: 'You do not have the permission to run this command because you\'re not a developer of me!',
        NOT_GUILD_OWNER: 'You do not have the permission to run this command because you\'re not the guild owner!',
        CHANNEL_NOT_NSFW: 'You cannot run this command in a non-NSFW channel!',
        MISSING_PERMISSIONS: 'You do not have the permission to run this command, missing permissions.',
        COMPONENT_NOT_PUBLIC: 'You are not the author of this button!',
        GUILD_COOLDOWN: 'You are currently in cooldown, you have the ability to re-use this command again in %cooldown%'
    }
};

module.exports = config;
