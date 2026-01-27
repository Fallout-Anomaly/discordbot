const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'bf',
        description: 'Submit feedback/requests specifically for the BOT.',
        options: [
            {
                name: 'feedback',
                description: 'Your bot-related feedback or feature idea',
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    },
    run: async (client, interaction) => {
        const feedback = interaction.options.getString('feedback');
        const feedbackChannelId = process.env.REPORT_CHANNEL_ID;

        if (!feedbackChannelId) {
            return interaction.reply({ content: "❌ Feedback channel is not configured.", ephemeral: true });
        }

        const channel = client.channels.cache.get(feedbackChannelId);
        if (!channel) return interaction.reply({ content: "❌ Feedback channel not found.", ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle('💡 New Bot Feedback')
            .addFields(
                { name: 'From', value: `${interaction.user.tag} (${interaction.user.id})` },
                { name: 'Feedback', value: feedback }
            )
            .setColor('#f1c40f')
            .setTimestamp();

        try {
            await channel.send({ embeds: [embed] });
            await interaction.reply({ content: '✅ Thank you! Your feedback has been sent to the developers.', ephemeral: true });
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: '❌ Failed to send feedback.', ephemeral: true });
        }
    }
}).toJSON();
