const { PermissionFlagsBits } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'unlock',
        description: 'Unlock the current channel.',
        defaultMemberPermissions: PermissionFlagsBits.ManageChannels.toString()
    },
    run: async (client, interaction) => {
        try {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                SendMessages: null
            });
            await interaction.reply({ content: '🔓 Channel has been unlocked.' });
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: '❌ Failed to unlock channel.', flags: 64 });
        }
    }
}).toJSON();
