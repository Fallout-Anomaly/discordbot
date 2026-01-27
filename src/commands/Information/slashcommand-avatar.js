const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'avatar',
        description: 'Display a user\'s avatar.',
        options: [
            {
                name: 'user',
                description: 'Select a user',
                type: ApplicationCommandOptionType.User,
                required: false
            }
        ]
    },
    run: async (client, interaction) => {
        const user = interaction.options.getUser('user') || interaction.user;
        const avatarUrl = user.displayAvatarURL({ dynamic: true, size: 4096 });

        const embed = new EmbedBuilder()
            .setTitle(`Avatar: ${user.tag}`)
            .setImage(avatarUrl)
            .setColor('#3498db')
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
}).toJSON();
