const { Events } = require('discord.js');
const Event = require('../../structure/Event');

module.exports = new Event({
    event: Events.GuildMemberAdd,
    once: false,
    run: async (client, member) => {
        const roleId = process.env.AUTOROLE_ID;
        if (!roleId) return;

        try {
            const role = member.guild.roles.cache.get(roleId);
            if (role) {
                // Check if bot can manage roles and if role is assignable
                if (!member.guild.members.me.permissions.has('ManageRoles')) {
                    console.error('[AUTOROLE] Missing "ManageRoles" permission.');
                    return;
                }
                if (role.position >= member.guild.members.me.roles.highest.position) {
                    console.error(`[AUTOROLE] Cannot assign role "${role.name}" because it is equal to or higher than the bot's highest role.`);
                    return;
                }

                await member.roles.add(role);
                console.log(`[AUTOROLE] Assigned role to ${member.user.tag}`);
            }
        } catch (error) {
            console.error('[AUTOROLE] Failed to assign role:', error.message);
        }
    }
}).toJSON();
