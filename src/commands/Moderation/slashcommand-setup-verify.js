const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-verify')
        .setDescription('Setup the verification message with a button')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    run: async (client, interaction) => {
        const channelId = process.env.VERIFY_CHANNEL_ID || interaction.channelId;
        const channel = client.channels.cache.get(channelId) || interaction.channel;

        const embed = new EmbedBuilder()
            .setTitle('🛡️ Survivor Verification')
            .setDescription('To gain access to the rest of the server, please confirm that you have read and understood our rules and guidelines.\n\nBy clicking the button below, you agree to follow the community standards.')
            .setColor('#3498db')
            .setFooter({ text: 'Anomaly Verification System' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('verify_member')
                .setLabel('Confirm & Verify')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
        );

        await channel.send({ embeds: [embed], components: [row] });

        await interaction.reply({ content: `✅ Verification setup sent to <#${channel.id}>!`, ephemeral: true });
    }
};
