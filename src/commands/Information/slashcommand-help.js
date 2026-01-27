const { EmbedBuilder } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'help',
        description: 'Show available commands and resources.'
    },
    run: async (client, interaction) => {
        const embed = new EmbedBuilder()
            .setTitle('☢️ Anomaly Support - Help')
            .setDescription('Welcome to the Anomaly Support system. Here are the available commands:')
            .addFields(
                { name: '🔍 AI Knowledge', value: '`/ask` - AI Search\n(Or just type in the support channel!)', inline: false },
                { name: '🛡️ Moderation', value: '`/kick`, `/ban`, `/timeout`, `/clear`, `/lock`, `/unlock`, `/setnick`', inline: false },
                { name: 'ℹ️ Information', value: '`/ping`, `/userinfo`, `/avatar`, `/banner`, `/serverinfo`', inline: false },
                { name: '🚨 Reports & Feedback', value: '`/report` - Alert staff\n`/bf` - Bot feedback', inline: false }
            )
            .setColor('#3498db')
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
}).toJSON();
