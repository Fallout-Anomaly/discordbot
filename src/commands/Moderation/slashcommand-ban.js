const { ApplicationCommandOptionType, PermissionFlagsBits } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'ban',
        description: 'Ban a user from the server.',
        options: [
            {
                name: 'user',
                description: 'The user to ban',
                type: ApplicationCommandOptionType.User,
                required: true
            },
            {
                name: 'reason',
                description: 'Reason for the ban',
                type: ApplicationCommandOptionType.String,
                required: false
            }
        ],
        defaultMemberPermissions: PermissionFlagsBits.BanMembers
    },
    run: async (client, interaction) => {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(() => null);

        if (member && !member.bannable) return interaction.reply({ content: '❌ I cannot ban this user.', ephemeral: true });

        try {
            await interaction.guild.members.ban(user.id, { reason });
            await interaction.reply({ content: `✅ **${user.tag}** has been banned. Reason: ${reason}` });
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: '❌ Failed to ban user.', ephemeral: true });
        }
    }
}).toJSON();
