const { ApplicationCommandOptionType, PermissionFlagsBits } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'clear',
        description: 'Delete a specified number of messages.',
        options: [
            {
                name: 'amount',
                description: 'Number of messages to delete (1-100)',
                type: ApplicationCommandOptionType.Integer,
                required: true,
                minValue: 1,
                maxValue: 100
            }
        ],
        defaultMemberPermissions: PermissionFlagsBits.manageMessages.toString()
    },
    run: async (client, interaction) => {
        const amount = interaction.options.getInteger('amount');

        await interaction.deferReply({ ephemeral: true });

        try {
            const deleted = await interaction.channel.bulkDelete(amount, true);
            await interaction.editReply({ content: `✅ Deleted ${deleted.size} messages.` });
        } catch (err) {
            console.error(err);
            await interaction.editReply({ content: `❌ Failed to delete messages: ${err.message}` });
        }
    }
}).toJSON();
