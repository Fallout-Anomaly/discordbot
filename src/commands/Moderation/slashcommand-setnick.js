const { ApplicationCommandOptionType, PermissionFlagsBits } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'setnick',
        description: 'Change a user\'s nickname.',
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
        defaultMemberPermissions: PermissionFlagsBits.ManageNicknames
    },
    run: async (client, interaction) => {
        const user = interaction.options.getUser('user');
        const nickname = interaction.options.getString('nickname');
        const member = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

        try {
            await member.setNickname(nickname);
            await interaction.reply({ content: `✅ Substituted nickname for **${user.tag}** to **${nickname}**.` });
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: '❌ Failed to change nickname.', ephemeral: true });
        }
    }
}).toJSON();
