const { ApplicationCommandOptionType, PermissionFlagsBits } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'setnick',
        description: 'Change a user\'s nickname.',
        defer: 'ephemeral',
        options: [
            {
                name: 'user',
                description: 'The user to change',
                type: ApplicationCommandOptionType.User,
                required: true
            },
            {
                name: 'nickname',
                description: 'The new nickname',
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ],
        defaultMemberPermissions: PermissionFlagsBits.ManageNicknames.toString()
    },
    run: async (client, interaction) => {
        const user = interaction.options.getUser('user');
        const nickname = interaction.options.getString('nickname');
        const member = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) return interaction.editReply({ content: '❌ User not found.' });

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

        // Bot capability checks
        const me = interaction.guild.members.me;
        if (!me?.permissions.has('ManageNicknames')) {
            return interaction.editReply({ content: '❌ I lack the "Manage Nicknames" permission.' });
        }
        if (!member.manageable) {
            return interaction.editReply({ content: '❌ I cannot change this user\'s nickname due to role hierarchy or missing permissions.' });
        }

        try {
            await member.setNickname(nickname);
            await interaction.editReply({ content: `✅ Substituted nickname for **${user.tag}** to **${nickname}**.` });
        } catch (err) {
            console.error(err);
            await interaction.editReply({ content: '❌ Failed to change nickname. Please check my permissions and role position.' });
        }
    }
}).toJSON();
