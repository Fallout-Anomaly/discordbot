const config = require('../config');
const { info, error, warn, success } = require('./Console');
const DonorSystem = require('./DonorSystem');

/**
 * FalloutChat relay.
 *
 * Bridges a Discord channel with the in-game chat WebSocket server. Game chat is
 * mirrored into Discord, Discord messages are mirrored into the game, and a set
 * of `!`-prefixed admin commands let staff moderate the game chat from Discord.
 *
 * Wire protocol (matches FalloutChat server/index.js):
 *   - Auth:           send `[BOT_AUTH]<secret>` on connect to become trusted.
 *   - Game → bot:     `[REL]<userId>\x02<formatted>` (trusted relay frames).
 *   - Discord → game: `0|[Discord] <name>|Discord: <text>` (id 0 = relay pseudo).
 *   - Moderation:     `[BAN]`, `[UNBAN]`, `[BANLIST]`, `[BLOCKNAME]`,
 *                     `[UNBLOCKNAME]`, `[BLOCKEDNAMES]` control frames; the
 *                     server answers with `[BANOK]/[BANERR]/[BANLIST]/[BLOCKEDNAMES]`.
 */
class ChatRelay {
    constructor() {
        this.client = null;
        this.channel = null;
        this.ws = null;
        this.wsReady = false;
        this.reconnecting = false;
        this.started = false;

        // Rolling map of recently-seen in-game players: lowercased name -> { id, name, ts }
        this.recentUsers = new Map();
        this.RECENT_MAX = 500;

        this.REL_DELIM = '\x02';
        this.HEX64_RE = /^[0-9a-f]{16}$/i;
        this.COMMANDS = ['!ban', '!unban', '!bans', '!whois', '!blockname', '!unblockname', '!blockednames'];
    }

    /**
     * Boot the relay. Call once on clientReady.
     * @param {import('discord.js').Client} client
     */
    async start(client) {
        if (this.started) return;

        const cfg = config.chat_relay;
        if (!cfg.enabled) {
            info('[ChatRelay] Disabled via config (CHAT_RELAY_ENABLED=false).');
            return;
        }
        if (!cfg.channel_id) {
            warn('[ChatRelay] No CHAT_RELAY_CHANNEL_ID set — relay not started.');
            return;
        }

        this.client = client;
        this.channel = await client.channels.fetch(cfg.channel_id).catch(() => null);
        if (!this.channel) {
            error(`[ChatRelay] Channel ${cfg.channel_id} not found — check CHAT_RELAY_CHANNEL_ID.`);
            return;
        }

        this.started = true;
        success(`[ChatRelay] Relaying #${this.channel.name} <-> game chat (${cfg.ws_url}).`);
        this.connectWS();
    }

    // ── User tracking ────────────────────────────────────────────────────────
    rememberUser(id, name) {
        if (!id || id === '0') return; // '0' is the Discord-relay pseudo id
        const key = String(name).toLowerCase();
        this.recentUsers.set(key, { id, name, ts: Date.now() });
        if (this.recentUsers.size > this.RECENT_MAX) {
            const oldest = [...this.recentUsers.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
            if (oldest) this.recentUsers.delete(oldest[0]);
        }
    }

    resolveTarget(arg) {
        if (arg.startsWith('id:')) return { id: arg.slice(3).trim(), via: 'id' };
        if (this.HEX64_RE.test(arg)) return { id: arg, via: 'id' };
        const hit = this.recentUsers.get(arg.toLowerCase());
        if (hit) return { id: hit.id, name: hit.name, via: 'name' };
        return null;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    escMd(s) {
        return String(s).replace(/([*_`~\\|])/g, '\\$1');
    }

    /**
     * A Discord user may moderate the relay if they are a configured bot
     * developer, hold the configured admin role, or have the Ban Members perm.
     */
    isAdmin(msg) {
        if (config.users.developers.includes(msg.author.id)) return true;
        const member = msg.member;
        if (!member) return false;
        const roleId = config.chat_relay.admin_role_id;
        if (roleId && member.roles?.cache?.has(roleId)) return true;
        if (member.permissions?.has('BanMembers')) return true;
        return false;
    }

    senderNameOf(formatted) {
        if (formatted.startsWith('[EMOTE]')) {
            const d = formatted.indexOf('\x01');
            return d !== -1 ? formatted.slice(7, d) : '';
        }
        const ci = formatted.indexOf(': ');
        return ci !== -1 ? formatted.slice(0, ci) : '';
    }

    relayToDiscord(formatted) {
        if (!this.channel) return;
        let text;
        if (formatted.startsWith('[EMOTE]')) {
            const d = formatted.indexOf('\x01');
            const sender = d !== -1 ? formatted.slice(7, d) : 'Someone';
            const action = d !== -1 ? formatted.slice(d + 1) : '';
            text = `_\\* **${this.escMd(sender)}** ${this.escMd(action)}_`;
        } else {
            const ci = formatted.indexOf(': ');
            if (ci === -1) return;
            text = `**${this.escMd(formatted.slice(0, ci))}**: ${this.escMd(formatted.slice(ci + 2))}`;
        }
        this.channel.send(text).catch(err => error('[ChatRelay] Discord send error:', err));
    }

    // ── WebSocket → Discord ────────────────────────────────────────────────────
    connectWS() {
        if (this.reconnecting) return;
        this.reconnecting = true;

        const { ws_url, bot_secret } = config.chat_relay;
        this.ws = new WebSocket(ws_url);

        this.ws.onopen = () => {
            this.wsReady = true;
            this.reconnecting = false;
            info('[ChatRelay] Connected to chat server.');
            if (bot_secret) this.ws.send(`[BOT_AUTH]${bot_secret}`);
        };

        this.ws.onmessage = ({ data }) => {
            const str = String(data);

            // Ignore protocol frames and history on connect
            if (str.startsWith('[COUNT]:') || str.startsWith('[HISTORY]')) return;

            // Moderation acks from the server
            if (str.startsWith('[BANOK]'))  { this.channel?.send(`✅ ${str.slice(7)}`).catch(() => {}); return; }
            if (str.startsWith('[BANERR]')) { this.channel?.send(`⚠️ ${str.slice(8)}`).catch(() => {}); return; }
            if (str.startsWith('[BANLIST]')) {
                const ids = str.slice(9).split(',').filter(Boolean);
                const body = ids.length ? ids.map(id => `\`${id}\``).join(', ') : '_(none)_';
                this.channel?.send(`🚫 **Banned IDs (${ids.length}):** ${body}`).catch(() => {});
                return;
            }
            if (str.startsWith('[BLOCKEDNAMES]')) {
                const terms = str.slice(14).split(',').filter(Boolean);
                const body = terms.length ? terms.map(t => `\`${t}\``).join(', ') : '_(none)_';
                this.channel?.send(`🔤 **Blocked name terms (${terms.length}):** ${body}`).catch(() => {});
                return;
            }

            // Relay frames carry the sender's userId: "[REL]<id>\x02<formatted>"
            let formatted = str;
            if (str.startsWith('[REL]')) {
                const d = str.indexOf(this.REL_DELIM);
                if (d !== -1) {
                    const id = str.slice(5, d);
                    formatted = str.slice(d + 1);
                    this.rememberUser(id, this.senderNameOf(formatted));
                } else {
                    formatted = str.slice(5);
                }
            }

            this.relayToDiscord(formatted);
        };

        this.ws.onclose = () => {
            this.wsReady = false;
            this.reconnecting = false;
            warn('[ChatRelay] Disconnected — reconnecting in 5s.');
            setTimeout(() => this.connectWS(), 5000);
        };

        this.ws.onerror = () => this.ws.close();
    }

    wsSend(payload) {
        if (!this.wsReady || this.ws?.readyState !== WebSocket.OPEN) return false;
        this.ws.send(payload);
        return true;
    }

    // ── Discord → WebSocket ────────────────────────────────────────────────────
    /**
     * Process a Discord message in the relay channel. Returns true if the
     * message was consumed (handled as a command or relayed).
     * @param {import('discord.js').Message} msg
     */
    async handleMessage(msg) {
        if (!this.started) return false;
        if (msg.author.bot) return false;
        if (msg.channelId !== config.chat_relay.channel_id) return false;
        if (!msg.content.trim()) return false;

        // Intercept moderation commands — never relayed into game chat
        if (msg.content.trim().startsWith('!')) {
            const handled = await this.handleCommand(msg);
            if (handled) return true;
        }

        if (!this.wsReady || this.ws?.readyState !== WebSocket.OPEN) {
            warn('[ChatRelay] Discord message received but WS not ready.');
            return false;
        }

        const baseName = msg.member?.displayName ?? msg.author.username;
        const content = msg.content.slice(0, 500);

        // Prefix supporters with their tier badge so donors are recognised in the
        // actual in-game chat, not just on Discord. Non-donors relay unchanged.
        let name = baseName;
        try {
            const tier = await DonorSystem.getEffectiveTier(msg.author.id, msg.member);
            const badge = DonorSystem.TIERS[tier]?.badge;
            if (badge) name = `${badge} ${baseName}`;
        } catch { /* fall back to the plain name on any lookup error */ }

        // Server trusts this because BOT_AUTH was sent on connect.
        this.ws.send(`0|[Discord] ${name}|Discord: ${content}`);
        return true;
    }

    async handleCommand(msg) {
        const [cmd, ...rest] = msg.content.trim().split(/\s+/);
        const arg = rest.join(' ').trim();
        const command = cmd.toLowerCase();

        if (!this.COMMANDS.includes(command)) return false;

        if (!this.isAdmin(msg)) {
            await msg.reply('⛔ You do not have permission to moderate the chat.').catch(() => {});
            return true;
        }

        if (command === '!bans') {
            if (!this.wsSend('[BANLIST]')) await msg.reply('⚠️ Chat server not connected.').catch(() => {});
            return true;
        }

        if (command === '!whois') {
            if (!arg) { await msg.reply('Usage: `!whois <name>`').catch(() => {}); return true; }
            const hit = this.recentUsers.get(arg.toLowerCase());
            await msg.reply(hit
                ? `\`${hit.name}\` → \`${hit.id}\``
                : `No recent in-game player named \`${arg}\`. They must have chatted since the bot last started.`
            ).catch(() => {});
            return true;
        }

        if (command === '!ban') {
            if (!arg) { await msg.reply('Usage: `!ban <name>` or `!ban id:<userid>`').catch(() => {}); return true; }
            const target = this.resolveTarget(arg);
            if (!target || !target.id) {
                await msg.reply(`Could not resolve \`${arg}\`. Use \`!whois <name>\` to find their id, then \`!ban id:<userid>\`.`).catch(() => {});
                return true;
            }
            if (!this.wsSend(`[BAN]${target.id}`)) await msg.reply('⚠️ Chat server not connected.').catch(() => {});
            return true;
        }

        if (command === '!unban') {
            if (!arg) { await msg.reply('Usage: `!unban <userid>`').catch(() => {}); return true; }
            const id = arg.startsWith('id:') ? arg.slice(3).trim() : arg;
            if (!this.wsSend(`[UNBAN]${id}`)) await msg.reply('⚠️ Chat server not connected.').catch(() => {});
            return true;
        }

        if (command === '!blockednames') {
            if (!this.wsSend('[BLOCKEDNAMES]')) await msg.reply('⚠️ Chat server not connected.').catch(() => {});
            return true;
        }

        if (command === '!blockname') {
            if (!arg) { await msg.reply('Usage: `!blockname <word>` — blocks any username containing it (leet-folded).').catch(() => {}); return true; }
            if (!this.wsSend(`[BLOCKNAME]${arg}`)) await msg.reply('⚠️ Chat server not connected.').catch(() => {});
            return true;
        }

        if (command === '!unblockname') {
            if (!arg) { await msg.reply('Usage: `!unblockname <word>`').catch(() => {}); return true; }
            if (!this.wsSend(`[UNBLOCKNAME]${arg}`)) await msg.reply('⚠️ Chat server not connected.').catch(() => {});
            return true;
        }

        return false;
    }
}

// Singleton — shared between the clientReady boot event and the messageCreate relay event.
module.exports = new ChatRelay();
