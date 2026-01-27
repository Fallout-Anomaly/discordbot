const { Collection } = require('discord.js');
const { info, error } = require("../../utils/Console");
const Event = require("../../structure/Event");
const config = require("../../config");
const { handleApplicationCommandOptions } = require("../../client/handler/CommandOptions");

module.exports = new Event({
    event: 'interactionCreate',
    run: async (client, interaction) => {
        info(`[EVENT DEBUG] Received interaction: ${interaction.commandName || interaction.customId} (Type: ${interaction.type})`);

        // AUTOCOMPLETE INTERACTIONS
        if (interaction.isAutocomplete()) {
            const command = client.collection.application_commands.get(interaction.commandName);
            if (!command) return;

            try {
                if (command.autocomplete) await command.autocomplete(client, interaction);
            } catch (err) {
                error(err);
            }
            return;
        }

        // COMPONENT INTERACTIONS (Buttons, Select Menus, Modals)
        // These must be acknowledged immediately to prevent 10062 Unknown interaction timeout
        const checkUserPermissions = async (component) => {
            if (component.options?.public === false && interaction.user.id !== interaction.message.interaction?.user?.id) {
                await interaction.reply({
                    content: config.messages.COMPONENT_NOT_PUBLIC,
                    ephemeral: true
                });
                return false;
            }
            return true;
        }

        try {
            if (interaction.isButton()) {
                // MUST acknowledge IMMEDIATELY using deferUpdate for component interactions
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferUpdate().catch(() => {});
                }

                const component = client.collection.components.buttons.get(interaction.customId);
                if (!component) {
                    info(`[BUTTON] Handler not found for button: ${interaction.customId}`);
                    return;
                }

                if (!(await checkUserPermissions(component))) return;

                try {
                    await component.run(client, interaction);
                } catch (err) {
                    error('[BUTTON]', err);
                }
                return;
            }

            if (interaction.isAnySelectMenu()) {
                // MUST acknowledge IMMEDIATELY using deferUpdate for component interactions
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferUpdate().catch(() => {});
                }

                const component = client.collection.components.selects.get(interaction.customId);
                if (!component) {
                    info(`[SELECT MENU] Handler not found for select menu: ${interaction.customId}`);
                    return;
                }

                if (!(await checkUserPermissions(component))) return;

                try {
                    await component.run(client, interaction);
                } catch (err) {
                    error('[SELECT MENU]', err);
                }
                return;
            }

            if (interaction.isModalSubmit()) {
                // MUST acknowledge IMMEDIATELY for modal interactions
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ ephemeral: true }).catch(() => {});
                }

                const component = client.collection.components.modals.get(interaction.customId);
                if (!component) {
                    info(`[MODAL] Handler not found for modal: ${interaction.customId}`);
                    return;
                }

                try {
                    await component.run(client, interaction);
                } catch (err) {
                    error('[MODAL]', err);
                }
                return;
            }
        } catch (err) {
            error('[COMPONENT HANDLER]', err);
            // Try to acknowledge if possible
            if (!interaction.replied && !interaction.deferred) {
                try {
                    if (interaction.isButton() || interaction.isAnySelectMenu()) {
                        await interaction.deferUpdate().catch(() => {});
                    } else if (interaction.isModalSubmit()) {
                        await interaction.deferReply({ ephemeral: true }).catch(() => {});
                    }
                } catch (ackErr) {
                    error('[COMPONENT HANDLER ACK ERROR]', ackErr);
                }
            }
            return;
        }

        // CHAT INPUT AND CONTEXT MENU COMMANDS
        if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return;

        const command = client.collection.application_commands.get(interaction.commandName);

        if (!command) {
            info(`[EVENT DEBUG] Command not found in collection: ${interaction.commandName}`);
            return;
        }

        // Developer Check
        if (command.developer && !config.users.developers.includes(interaction.user.id)) {
            return interaction.reply({ content: config.messages.NOT_BOT_DEVELOPER, flags: 64 });
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
                return interaction.reply({ content: message, flags: 64 }).catch(() => {});
            }
        }

        timestamps.set(interaction.user.id, now);
        setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

        try {
            if (command.options) {
                const commandContinue = await handleApplicationCommandOptions(interaction, command.options, command.command);
                if (!commandContinue) return;
            }

            // Automatic defer if command is marked as slow
            // IMPORTANT: If command.defer is true, command.run() MUST use interaction.editReply() 
            // instead of interaction.reply() to avoid "Interaction already acknowledged" error
            const shouldDefer = command.defer || command.command?.defer;
            if (shouldDefer) {
                const flags = shouldDefer === 'ephemeral' ? 64 : undefined;
                await interaction.deferReply(flags ? { flags } : {}).catch(() => {});
            }

            await command.run(client, interaction);
        } catch (err) {
            error(err);
            const content = 'There was an error while executing this command!';
            if (interaction.replied) {
                await interaction.followUp({ content, flags: 64 }).catch(e => error(e));
            } else if (interaction.deferred) {
                await interaction.editReply({ content }).catch(e => error(e));
            } else {
                await interaction.reply({ content, flags: 64 }).catch(e => error(e));
            }
        }
    }
}).toJSON();
