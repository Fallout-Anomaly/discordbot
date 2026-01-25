const { SlashCommandBuilder } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: new SlashCommandBuilder()
        .setName('report')
        .setDescription('Report a user to the staff team.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user you want to report')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('The reason for the report')
                .setRequired(true)),
    
    run: async (client, interaction) => {
        const reportedUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const reportChannelId = process.env.REPORT_CHANNEL_ID;

        // Validate Report Channel
        const reportChannel = client.channels.cache.get(reportChannelId);
        if (!reportChannel) {
            await interaction.editReply({ content: 'Error: Report channel not configured. Please contact an admin.' });
            return;
        }

        try {
            // Send report to staff channel
            await reportChannel.send({
                content: `🚨 **NEW REPORT** 🚨\n\n**Reporter:** ${interaction.user.tag} (<@${interaction.user.id}>)\n**Reported User:** ${reportedUser.tag} (<@${reportedUser.id}>)\n**Reason:** ${reason}\n\n<@&${process.env.STAFF_ROLE_ID}>` 
            });

            // Confirm to user
            await interaction.editReply({ content: '✅ Your report has been submitted to the staff team. Thank you.' });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'Failed to submit report due to an internal error.' });
        }
    }
}).toJSON();
