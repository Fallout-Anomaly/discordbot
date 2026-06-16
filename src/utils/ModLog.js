const { EmbedBuilder } = require('discord.js');
const { error } = require('./Console');

// Per-action accent colours for the audit embeds.
const ACTION_COLORS = {
    Ban: '#e74c3c',
    Kick: '#e67e22',
    Timeout: '#f1c40f',
    Clear: '#3498db',
    Nickname: '#9b59b6',
    Lock: '#607d8b',
    Unlock: '#2ecc71'
};

function label(u) {
    if (!u) return 'Unknown';
    const name = u.tag ?? u.username ?? String(u);
    return u.id ? `${name} (\`${u.id}\`)` : name;
}

/**
 * Post a moderation audit entry to LOGS_CHANNEL_ID. Best-effort and non-blocking:
 * if no log channel is configured or the send fails, it is swallowed (logged to
 * console) so it never breaks the moderation action itself.
 *
 * @param {import('discord.js').Client} client
 * @param {object} opts
 * @param {string} opts.action   One of the ACTION_COLORS keys (Ban, Kick, ...).
 * @param {import('discord.js').User} [opts.moderator]  Who performed the action.
 * @param {import('discord.js').User} [opts.target]     Who it was performed on.
 * @param {string} [opts.reason]
 * @param {import('discord.js').GuildChannel} [opts.channel]  Relevant channel.
 * @param {{name:string,value:string,inline?:boolean}[]} [opts.fields]  Extra fields.
 */
async function logModAction(client, { action, moderator, target, reason, channel, fields } = {}) {
    const logChannelId = process.env.LOGS_CHANNEL_ID;
    if (!logChannelId) return;

    try {
        let logChannel = client.channels.cache.get(logChannelId);
        if (!logChannel) logChannel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel || typeof logChannel.isTextBased !== 'function' || !logChannel.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setTitle(`🛡️ ${action}`)
            .setColor(ACTION_COLORS[action] || '#7289da')
            .setTimestamp();

        if (moderator) embed.addFields({ name: 'Moderator', value: label(moderator), inline: true });
        if (target) embed.addFields({ name: 'Target', value: label(target), inline: true });
        if (channel) embed.addFields({ name: 'Channel', value: `<#${channel.id}>`, inline: true });
        if (Array.isArray(fields)) for (const f of fields) embed.addFields(f);
        if (reason) embed.addFields({ name: 'Reason', value: String(reason).slice(0, 1024), inline: false });

        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        error('[ModLog] Failed to write audit log:', err.message);
    }
}

module.exports = { logModAction };
