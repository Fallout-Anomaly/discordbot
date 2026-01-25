const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Purges a specific amount of messages.')
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('Amount of messages to delete (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');

        try {
            const deleted = await interaction.channel.bulkDelete(amount, true);

            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setDescription(`Successfully deleted **${deleted.size}** messages.`);

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Clear error:', error);
            await interaction.reply({ content: 'Failed to purge messages. They might be older than 14 days.', ephemeral: true });
        }
    },
};
