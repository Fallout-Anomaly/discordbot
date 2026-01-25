const { ChatInputCommandInteraction } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'ping',
        description: 'Replies with Pong!',
        type: 1,
        options: []
    },
    options: {
        cooldown: 5000
    },
    /**
     * 
     * @param {DiscordBot} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    run: async (client, interaction) => {
        const sent = await interaction.editReply({ content: 'Pinging...' });
        interaction.editReply({
            content: `**Pong!** Roundtrip latency: ${sent.createdTimestamp - interaction.createdTimestamp}ms`
        });
    }
}).toJSON();