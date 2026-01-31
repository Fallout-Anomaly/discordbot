const { Events, PermissionsBitField } = require('discord.js');
const Event = require('../../structure/Event');
const config = require('../../config');

function isTrustedMember(member, trustedRoleIds) {
    if (!member) return false;
    if (member.permissions?.has(PermissionsBitField.Flags.ManageMessages)) return true;
    if (!Array.isArray(trustedRoleIds) || trustedRoleIds.length === 0) return false;
    return trustedRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

module.exports = new Event({
    event: Events.MessageCreate,
    once: false,
    run: async (_client, message) => {
        if (message.author.bot || !message.guild) return;

        const guard = config.moderation?.scam_guard;
        if (!guard?.enabled) return;

        if (guard.ignoreChannels?.includes(message.channel.id)) return;
        if (guard.monitorChannels?.length && !guard.monitorChannels.includes(message.channel.id)) return;

        const trustedRoleIds = [config.roles?.staff_role, ...(guard.trustedRoles || [])].filter(Boolean);
        if (isTrustedMember(message.member, trustedRoleIds)) return;

        const hasAttachment = message.attachments?.size > 0;
        const hasEmbed = message.embeds?.length > 0;

        const accountAgeMs = Date.now() - message.author.createdTimestamp;
        const joinAgeMs = message.member?.joinedTimestamp ? Date.now() - message.member.joinedTimestamp : Infinity;
        const isNewAccount = guard.minAccountAgeDays ? accountAgeMs < guard.minAccountAgeDays * 86400000 : false;
        const isNewMember = guard.minJoinAgeDays ? joinAgeMs < guard.minJoinAgeDays * 86400000 : false;

        const shouldDeleteForAttachments = guard.deleteAttachments && (hasAttachment || hasEmbed);
        const shouldDeleteForNewAccount = guard.blockNewAccountAttachments && (hasAttachment || hasEmbed) && (isNewAccount || isNewMember);

        if (!shouldDeleteForAttachments && !shouldDeleteForNewAccount) return;

        await message.delete().catch(() => {});

        if (guard.notifyUser) {
            message.channel.send({
                content: `⚠️ <@${message.author.id}> your message was removed by scam protection. If this was a mistake, contact staff.`
            }).then((m) => setTimeout(() => m.delete().catch(() => {}), 8000));
        }
    }
}).toJSON();
