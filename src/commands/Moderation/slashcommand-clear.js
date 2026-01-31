const { ApplicationCommandOptionType, PermissionFlagsBits } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const { error } = require("../../utils/Console");

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
        defaultMemberPermissions: PermissionFlagsBits.ManageMessages.toString()
    },
    defer: { flags: 64 },
    run: async (client, interaction) => {
        const amount = interaction.options.getInteger('amount');

        try {
            const deleted = await interaction.channel.bulkDelete(amount, true);
            
            if (deleted.size === 0) {
                return interaction.editReply({ 
                    content: '⚠️ No messages could be deleted. Messages older than 14 days cannot be bulk deleted.' 
                });
            }

            await interaction.editReply({ content: `✅ Deleted ${deleted.size} messages.` });
        } catch (err) {
            error('Clear command error:', err);
            await interaction.editReply({ content: `❌ Failed to delete messages: ${err.message}` });
        }
    }
}).toJSON();
