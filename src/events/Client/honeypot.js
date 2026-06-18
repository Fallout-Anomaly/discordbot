const { Events, PermissionsBitField, EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');
const config = require('../../config');
const { warn, error } = require('../../utils/Console');

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

        const trap = config.moderation?.honeypot;
        if (!trap?.enabled || !trap.channelId) return;

        // Match the honeypot channel itself or any thread under it.
        const channelIds = [message.channel.id, message.channel.parentId].filter(Boolean);
        if (!channelIds.includes(trap.channelId)) return;

        // Partials.Message is enabled, so message.member can be null. Without it we can't
        // evaluate role/permission exemptions or join age — fetch it so we never ban staff by mistake.
        let member = message.member;
        if (!member) {
            member = await message.guild.members.fetch(message.author.id).catch(() => null);
        }

        const trustedRoleIds = [config.roles?.staff_role, ...(trap.trustedRoles || [])].filter(Boolean);
        if (isExempt(member, trustedRoleIds)) return;

        // "New / suspicious account" gate: only ban accounts below the configured ages.
        const now = Date.now();
        const accountAgeMs = now - message.author.createdTimestamp;
        const joinAgeMs = member?.joinedTimestamp ? now - member.joinedTimestamp : Infinity;
        const isNewAccount = trap.minAccountAgeDays ? accountAgeMs < trap.minAccountAgeDays * 86400000 : false;
        const isNewMember = trap.minJoinAgeDays ? joinAgeMs < trap.minJoinAgeDays * 86400000 : false;
        if (!isNewAccount && !isNewMember) return;

        if (member && !member.bannable) {
            warn(`[HONEYPOT] Cannot ban ${message.author.tag} (${message.author.id}) — missing perms or role hierarchy.`);
            return;
        }

        const reason = 'Honeypot: posted in the do-not-post trap channel (new/suspicious account)';
        const deleteSeconds = Math.min((trap.deleteMessageDays || 0) * 86400, 604800);

        try {
            await message.guild.members.ban(message.author.id, { reason, deleteMessageSeconds: deleteSeconds });
        } catch (e) {
            error(`[HONEYPOT] Ban failed for ${message.author.id}: ${e.message}`);
            return;
        }

        const logChannel = client.channels.cache.get(process.env.LOGS_CHANNEL_ID);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('🪤 Honeypot Auto-Ban')
                .setColor('#ff0000')
                .addFields(
                    { name: 'User', value: `${message.author.tag} (${message.author.id})` },
                    { name: 'Channel', value: `<#${message.channel.id}>` },
                    { name: 'Account Age', value: `${Math.floor(accountAgeMs / 86400000)}d`, inline: true },
                    { name: 'Member Age', value: Number.isFinite(joinAgeMs) ? `${Math.floor(joinAgeMs / 86400000)}d` : 'unknown', inline: true }
                )
                .setTimestamp();
            logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    }
}).toJSON();
