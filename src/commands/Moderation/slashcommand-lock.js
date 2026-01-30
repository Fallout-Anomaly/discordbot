const { PermissionFlagsBits } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'lock',
        description: 'Lock the current channel.',
        defaultMemberPermissions: PermissionFlagsBits.ManageChannels.toString()
    },
    run: async (client, interaction) => {
        try {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                SendMessages: false
            });
            await interaction.reply({ content: '🔒 Channel has been locked.' });
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: '❌ Failed to lock channel.', flags: 64 });
        }
    }
}).toJSON();
