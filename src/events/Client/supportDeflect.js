const { Events, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Event = require('../../structure/Event');
const config = require('../../config');
const { looksLikeSupportRequest } = require('../../utils/SupportDetect');
const strikes = require('../../utils/SupportStrikes');
const { warn } = require('../../utils/Console');

function isExempt(member, trustedRoleIds) {
    if (!member) return false;
    if (member.permissions?.has(PermissionsBitField.Flags.BanMembers)) return true;
    if (member.permissions?.has(PermissionsBitField.Flags.Administrator)) return true;
    if (member.id === config.users?.ownerId) return true;
    if (!Array.isArray(trustedRoleIds) || trustedRoleIds.length === 0) return false;
    return trustedRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

module.exports = new Event({
    event: Events.MessageCreate,
    once: false,
    run: async (client, message) => {
        if (message.author.bot || message.system || !message.guild) return;

        const cfg = config.moderation?.support_deflect;
        if (!cfg?.enabled) return;

        const monitorChannels = (cfg.monitorChannels && cfg.monitorChannels.length)
            ? cfg.monitorChannels
            : (config.channels?.auto_response || []);
        if (!monitorChannels.includes(message.channel.id)) return;

        const forumChannelId = cfg.forumChannelId || (config.channels?.forum_support || [])[0];
        if (!forumChannelId) return;

        // Don't treat bot commands (e.g. "!help ...") as support posts, and don't
        // deflect a message that's just pinging the bot — questionHandler answers those.
        const prefix = config.commands?.prefix;
        if (prefix && message.content.startsWith(prefix)) return;
        if (message.mentions?.has?.(client.user.id) && !message.mentions.everyone) return;

        const detection = looksLikeSupportRequest(message.content, {
            minLength: cfg.minLength,
            extraKeywords: cfg.extraKeywords
        });
        if (!detection.match) return;

        // Don't nudge or strike staff/trusted members.
        let member = message.member;
        if (!member) member = await message.guild.members.fetch(message.author.id).catch(() => null);
        const trustedRoleIds = [config.roles?.staff_role, ...(cfg.trustedRoles || [])].filter(Boolean);
        if (isExempt(member, trustedRoleIds)) return;

        // ── Repeat-offender escalation ───────────────────────────────────────────
        // Every detected support message in main chat is a "strike." Enough strikes
        // inside the rolling window = a timeout (escalating in length each time).
        const ro = cfg.repeatOffender || {};
        const windowMs = (ro.windowMinutes ?? 60) * 60000;
        const strikeCount = strikes.addStrike(message.author.id, windowMs);

        if (ro.enabled && strikeCount >= (ro.strikesBeforeTimeout ?? 3)) {
            if (member?.moderatable) {
                const baseMs = (ro.timeoutMinutes ?? 10) * 60000;
                const maxMs = (ro.maxTimeoutMinutes ?? 1440) * 60000;
                const durationMs = strikes.timeoutDurationMs(message.author.id, baseMs, maxMs, ro.escalate !== false);
                const reason = 'Repeatedly posting support requests in main chat after being asked to use the support forum';

                const timedOut = await member.timeout(durationMs, reason).then(() => true).catch(() => false);
                if (timedOut) {
                    strikes.recordTimeout(message.author.id); // advance escalation only on success
                    strikes.clearStrikes(message.author.id);
                    const minutes = Math.round(durationMs / 60000);

                    await message.reply({
                        content: `⏳ <@${message.author.id}>, you've been timed out for **${minutes} min** for repeatedly posting support questions in main chat. ` +
                            `Please use <#${forumChannelId}> when you're back so we can actually help you.`
                    }).catch(() => {});

                    const logChannelId = ro.notifyChannelId || process.env.LOGS_CHANNEL_ID;
                    const logChannel = logChannelId ? client.channels.cache.get(logChannelId) : null;
                    if (logChannel) {
                        const embed = new EmbedBuilder()
                            .setTitle('⏳ Support Deflect — Auto Timeout')
                            .setColor('#e67e22')
                            .addFields(
                                { name: 'User', value: `${message.author.tag} (${message.author.id})` },
                                { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                                { name: 'Duration', value: `${minutes} min`, inline: true },
                                { name: 'Message', value: message.content.slice(0, 300) || '(none)' }
                            )
                            .setTimestamp();
                        logChannel.send({ embeds: [embed] }).catch(() => {});
                    }
                    return; // timed out — don't also post a nudge
                }
                warn(`[SUPPORT DEFLECT] Wanted to timeout ${message.author.tag} but the timeout call failed.`);
            } else {
                warn(`[SUPPORT DEFLECT] ${message.author.tag} hit the strike threshold but isn't moderatable (perms/hierarchy).`);
            }
            // Fall through to nudge if we couldn't time them out.
        }

        // ── Normal nudge (cooldown-gated) ────────────────────────────────────────
        const cooldownMs = (cfg.cooldownSeconds ?? 600) * 1000;
        if (!strikes.shouldNudge(message.author.id, cooldownMs)) return;
        strikes.markNudged(message.author.id);

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setDescription(
                `Hey <@${message.author.id}>, that looks like a support question! ` +
                `You'll get a faster, better answer in our support forum where it won't scroll away.\n\n` +
                `Click the button below and I'll move your message there for you.`
            )
            .setFooter({ text: 'Anomaly Support • only you (or staff) can use this button' });

        const customId = `supportmove:${message.author.id}:${message.channel.id}:${message.id}`;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(customId)
                .setLabel('Move to support forum')
                .setEmoji('📨')
                .setStyle(ButtonStyle.Primary)
        );

        await message.reply({ embeds: [embed], components: [row] }).catch(() => {});
    }
}).toJSON();
