const { info, error } = require("../../utils/Console");
const Event = require("../../structure/Event");
const config = require("../../config");
const { handleApplicationCommandOptions } = require("../../client/handler/CommandOptions");

module.exports = new Event({
    event: 'interactionCreate',
    run: async (client, interaction) => {
        info(`[EVENT DEBUG] Received interaction: ${interaction.commandName || interaction.customId} (Type: ${interaction.type})`);

        if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return;

        const command = client.collection.application_commands.get(interaction.commandName);

        if (!command) {
            info(`[EVENT DEBUG] Command not found in collection: ${interaction.commandName}`);
            return;
        }

        try {
            if (command.options) {
                const commandContinue = await handleApplicationCommandOptions(interaction, command.options, command.command);
                if (!commandContinue) return;
            }

            await command.run(client, interaction);
        } catch (err) {
            error(err);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    }
}).toJSON();
