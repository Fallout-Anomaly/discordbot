const { ApplicationCommandOptionType, PermissionFlagsBits } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'kick',
        description: 'Kick a user from the server.',
        defer: { flags: 64 },
        options: [
            {
                name: 'user',
                description: 'The user to kick',
                type: ApplicationCommandOptionType.User,
                required: true
            },
            {
                name: 'reason',
                description: 'Reason for the kick',
                type: ApplicationCommandOptionType.String,
                required: false
            }
        ],
        defaultMemberPermissions: PermissionFlagsBits.KickMembers.toString()
    },
    run: async (client, interaction) => {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) return interaction.editReply({ content: '❌ User not found in this server.' });

        // Role hierarchy checks to ensure executor outranks target (unless executor is server owner)
        if (member.id === interaction.guild.ownerId) {
            return interaction.editReply({ content: '❌ You cannot punish the server owner.' });
        }
        if (interaction.user.id !== interaction.guild.ownerId &&
            interaction.member.roles.highest.position <= member.roles.highest.position) {
            return interaction.editReply({ 
                content: '❌ You cannot punish a member with an equal or higher role than yourself.' 
            });
        }

        if (!member.kickable) return interaction.editReply({ content: '❌ I cannot kick this user.' });

        try {
            await member.kick(reason);
            await interaction.editReply({ content: `✅ **${user.tag}** has been kicked. Reason: ${reason}` });
        } catch (err) {
            console.error(err);
            await interaction.editReply({ content: '❌ Failed to kick user.' });
        }
    }
}).toJSON();
