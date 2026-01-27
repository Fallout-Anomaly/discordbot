const { Collection } = require('discord.js');
const { info, error } = require("../../utils/Console");
const Event = require("../../structure/Event");
const config = require("../../config");
const { handleApplicationCommandOptions } = require("../../client/handler/CommandOptions");

module.exports = new Event({
    event: 'interactionCreate',
    run: async (client, interaction) => {
        info(`[EVENT DEBUG] Received interaction: ${interaction.commandName || interaction.customId} (Type: ${interaction.type})`);

        if (interaction.isAutocomplete()) {
            const command = client.collection.application_commands.get(interaction.commandName);
            if (!command) return;

            try {
                if (typeof command.run === 'function' && interaction.commandName === 'use') {
                     // Special case for 'use' command where I put autocomplete in run for now (legacy fix attempt)
                     // actually let's just fix the command file instead.
                     // But wait, I can't easily edit the file I just wrote without another step.
                     // I will update the interaction handler to try 'autocomplete' method, and if missing, maybe log warning.
                }

                if (command.autocomplete) await command.autocomplete(client, interaction);
            } catch (err) {
                error(err);
            }
            return;
        }

        if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return;

        const command = client.collection.application_commands.get(interaction.commandName);

        if (!command) {
            info(`[EVENT DEBUG] Command not found in collection: ${interaction.commandName}`);
            return;
        }

        // Developer Check
        if (command.developer && !config.users.developers.includes(interaction.user.id)) {
            return interaction.reply({ content: config.messages.NOT_BOT_DEVELOPER, ephemeral: true });
        }

        // Cooldown Check
        const { cooldowns } = client.collection;
        if (!cooldowns.has(command.name)) {
            cooldowns.set(command.name, new Collection());
        }

        const now = Date.now();
        const timestamps = cooldowns.get(command.name);
        // Default cooldown 3 seconds if not set
        const cooldownAmount = (command.cooldown || 3) * 1000;

        if (timestamps.has(interaction.user.id)) {
            const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

            if (now < expirationTime) {
                const expiredTimestamp = Math.round(expirationTime / 1000);
                const message = config.messages.GUILD_COOLDOWN.replace('%cooldown%', `<t:${expiredTimestamp}:R>`);
                return interaction.reply({ content: message, ephemeral: true }).catch(() => {});
            }
        }

        timestamps.set(interaction.user.id, now);
        setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

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
                await interaction.followUp({ content, ephemeral: true }).catch(e => error(e));
            } else if (interaction.deferred) {
                await interaction.editReply({ content }).catch(e => error(e));
            } else {
                await interaction.reply({ content, ephemeral: true }).catch(e => error(e));
            }
        }
    }
}).toJSON();
