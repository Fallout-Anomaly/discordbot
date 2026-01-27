const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'userinfo',
        description: 'Display information about a user.',
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
        const member = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(() => null);

        const embed = new EmbedBuilder()
            .setTitle(`User Info: ${user.tag}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'ID', value: user.id, inline: true },
                { name: 'Joined Discord', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setColor('#3498db')
            .setTimestamp();

        if (member) {
            embed.addFields(
                { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: 'Roles', value: member.roles.cache.size > 1 ? member.roles.cache.filter(r => r.name !== '@everyone').map(r => `<@&${r.id}>`).join(', ') : 'None' }
            );
        }

        await interaction.editReply({ embeds: [embed] });
    }
}).toJSON();
