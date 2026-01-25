const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Puts a user in timeout.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to timeout')
                .setRequired(true)
        )
        .addIntegerOption(option => 
            option.setName('duration')
                .setDescription('Duration in minutes')
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('The reason for the timeout')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
        }

        try {
            await member.timeout(duration * 60 * 1000, reason);

            const embed = new EmbedBuilder()
                .setColor('#ffa500')
                .setTitle('User Timed Out')
                .addFields(
                    { name: 'Target', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Duration', value: `${duration} minutes`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Timeout error:', error);
            await interaction.reply({ content: 'Failed to timeout the user.', ephemeral: true });
        }
    },
};
