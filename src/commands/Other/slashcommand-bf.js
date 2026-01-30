const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'bf',
        description: 'Submit feedback/requests specifically for the BOT.',
        defer: { flags: 64 },
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
            return interaction.editReply({ content: "❌ Feedback channel is not configured." });
        }

        const channel = await client.channels.fetch(feedbackChannelId).catch(() => null);
        if (!channel) return interaction.editReply({ content: "❌ Feedback channel not found." });

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
            await interaction.editReply({ content: '✅ Thank you! Your feedback has been sent to the developers.' });
        } catch (err) {
            console.error(err);
            await interaction.editReply({ content: '❌ Failed to send feedback.' });
        }
    }
}).toJSON();
