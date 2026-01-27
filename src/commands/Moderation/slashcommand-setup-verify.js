const { ApplicationCommandOptionType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'setup-verify',
        description: 'Post the verification message in the current channel.',
        defaultMemberPermissions: PermissionFlagsBits.Administrator
    },
    run: async (client, interaction) => {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Server Verification')
            .setDescription('Welcome to the server! Click the button below to verify yourself and gain access to the rest of the channels.')
            .setColor('#27ae60')
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_member')
                    .setLabel('Verify Me')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );

        await interaction.reply({ content: '✅ Verification setup sent.', ephemeral: true });
        await interaction.channel.send({ embeds: [embed], components: [row] });
    }
}).toJSON();
