const { Message, EmbedBuilder } = require("discord.js");
const MessageCommand = require("../../structure/MessageCommand");

module.exports = new MessageCommand({
    command: {
        name: 'addrole',
        description: 'Mass add a role to all members who do not have it.',
        aliases: ['massrole'],
    },
    options: {
        botOwner: true
    },
    /**
     * 
     * @param {import("../../client/DiscordBot")} client 
     * @param {Message} message 
     * @param {string[]} args 
     */
    run: async (client, message, args) => {
        // Parse role from args (ID or Mention)
        const roleId = args[0]?.replace(/[<@&>]/g, '');
        if (!roleId) return message.reply('Please provide a role ID or mention.');

        const role = message.guild.roles.cache.get(roleId);
        if (!role) return message.reply('Role not found.');

        // Safety check
        if (role.permissions.has('Administrator') || role.permissions.has('ManageGuild')) {
             return message.reply('❌ Safety Catch: You cannot mass-assign a role with Administrator or Manage Guild permissions.');
        }

        const msg = await message.reply(`🔄 Fetching members...`);

        try {
            const members = await message.guild.members.fetch();
            const eligibleMembers = members.filter(m => !m.user.bot && !m.roles.cache.has(role.id));
            
            if (eligibleMembers.size === 0) {
                return msg.edit(`✅ No action needed. All ${members.size} non-bot members already have the **${role.name}** role.`);
            }

            await msg.edit(`found ${eligibleMembers.size} members to update. Starting process...`);

            let successCount = 0;
            let errorCount = 0;
            let processed = 0;
            const total = eligibleMembers.size;

            for (const [id, member] of eligibleMembers) {
                try {
                    await member.roles.add(role, 'Mass Add Role Command');
                    successCount++;
                } catch (e) {
                    errorCount++;
                    console.error(`[AddRole] Failed for ${member.user.tag}: ${e.message}`);
                }
                
                processed++;
                if (processed % 50 === 0) {
                    await msg.edit(`🔄 Processing: ${processed}/${total}.\nSuccess: ${successCount}\nErrors: ${errorCount}`);
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Mass Role Assignment Complete')
                .setColor('#2ecc71')
                .addFields(
                    { name: 'Role', value: `<@&${role.id}>`, inline: true },
                    { name: 'Total Targeted', value: `${total}`, inline: true },
                    { name: 'Success', value: `${successCount}`, inline: true },
                    { name: 'Failed', value: `${errorCount}`, inline: true }
                )
                .setTimestamp();

            await msg.edit({ content: null, embeds: [embed] });

        } catch (e) {
            console.error(e);
            await msg.edit(`❌ detailed error: ${e.message}`);
        }
    }
}).toJSON();
