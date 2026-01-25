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
            const content = 'There was an error while executing this command!';
            if (interaction.replied) {
                await interaction.followUp({ content, ephemeral: true }).catch(() => {});
            } else if (interaction.deferred) {
                await interaction.editReply({ content }).catch(() => {});
            } else {
                await interaction.reply({ content, ephemeral: true }).catch(() => {});
            }
        }
    }
}).toJSON();
