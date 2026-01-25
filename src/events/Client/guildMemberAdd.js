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
                await member.roles.add(role);
                console.log(`[AUTOROLE] Assigned role to ${member.user.tag}`);
            }
        } catch (error) {
            console.error('[AUTOROLE] Failed to assign role:', error.message);
        }
    }
}).toJSON();
