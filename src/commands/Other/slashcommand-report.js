const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'report',
        description: 'Report a user or an issue to the staff.',
        options: [
            {
                name: 'user',
                description: 'The user you are reporting',
                type: ApplicationCommandOptionType.User,
                required: true
            },
            {
                name: 'reason',
                description: 'Reason for the report',
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    },
    run: async (client, interaction) => {
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const reportChannelId = process.env.REPORT_CHANNEL_ID;

        if (!reportChannelId) {
            return interaction.reply({ content: "❌ Report channel is not configured.", ephemeral: true });
        }

        const reportChannel = await client.channels.fetch(reportChannelId).catch(() => null);
        if (!reportChannel) {
            return interaction.reply({ content: "❌ Could not find report channel.", ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('🚨 New Report Received')
            .addFields(
                { name: 'Reporter', value: `${interaction.user.tag} (${interaction.user.id})` },
                { name: 'Target', value: `${target.tag} (${target.id})` },
                { name: 'Reason', value: reason },
                { name: 'Channel', value: `<#${interaction.channel.id}>` }
            )
            .setColor('#e74c3c')
            .setTimestamp();

        try {
            await reportChannel.send({ embeds: [embed] });
            await interaction.reply({ content: "✅ Your report has been sent to the staff team.", ephemeral: true });
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: "❌ Failed to send report.", ephemeral: true });
        }
    }
}).toJSON();
