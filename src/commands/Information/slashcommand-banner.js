const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'banner',
        description: 'Display a user\'s banner.',
        defer: 'ephemeral',
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
        
        // Fetch full user to get banner info
        const fullUser = await client.users.fetch(user.id, { force: true });

        if (!fullUser.banner) {
            return interaction.reply({ content: `❌ **${user.tag}** does not have a banner.`, ephemeral: true });
        }

        const bannerUrl = fullUser.bannerURL({ dynamic: true, size: 4096 });

        const embed = new EmbedBuilder()
            .setTitle(`${user.username}'s Banner`)
            .setImage(bannerUrl)
            .setColor('#3498db')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
}).toJSON();
