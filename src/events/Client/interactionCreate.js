const { Collection } = require('discord.js');
const { info, error } = require("../../utils/Console");
const Event = require("../../structure/Event");
const config = require("../../config");
const { handleApplicationCommandOptions } = require("../../client/handler/CommandOptions");

module.exports = new Event({
    event: 'interactionCreate',
    run: async (client, interaction) => {
        // 1. Acknowledge IMMEDIATELY for component interactions to stop "Interaction Failed"
        if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
            if (!interaction.deferred && !interaction.replied) {
                try {
                    const start = Date.now();
                    await interaction.deferReply({ flags: 64 });
                    info(`[DEBUG] claimed interaction ${interaction.customId} in ${Date.now() - start}ms`);
                } catch (err) {
                    if (err.code === 40060 || err.message.includes('already been acknowledged')) {
                        info(`[DEBUG] interaction ${interaction.customId} already acknowledged, proceeding...`);
                    } else {
                        error(`[DEBUG] FAILED to claim interaction ${interaction.customId}:`, err.message);
                        return; // Stop processing for other errors
                    }
                }
            }
        }

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
                const replyData = {
                    content: config.messages.COMPONENT_NOT_PUBLIC,
                    flags: 64 // Use flags for ephemeral in v14
                };

                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp(replyData);
                } else {
                    await interaction.reply(replyData);
                }
                return false;
            }
            return true;
        }

        try {
            if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
                let component;
                if (interaction.isButton()) {
                    component = client.collection.components.buttons.get(interaction.customId);
                    if (!component) {
                        for (const [pattern, comp] of client.collection.components.buttons) {
                            if (pattern instanceof RegExp && pattern.test(interaction.customId)) {
                                component = comp;
                                break;
                            }
                        }
                    }
                } else if (interaction.isAnySelectMenu()) {
                    component = client.collection.components.selects.get(interaction.customId);
                    if (!component) {
                        for (const [pattern, comp] of client.collection.components.selects) {
                            if (pattern instanceof RegExp && pattern.test(interaction.customId)) {
                                component = comp;
                                break;
                            }
                        }
                    }
                } else if (interaction.isModalSubmit()) {
                    component = client.collection.components.modals.get(interaction.customId);
                    if (!component) {
                        for (const [pattern, comp] of client.collection.components.modals) {
                            if (pattern instanceof RegExp && pattern.test(interaction.customId)) {
                                component = comp;
                                break;
                            }
                        }
                    }
                }

                if (!component) {
                    info(`[COMPONENT] Handler not found for: ${interaction.customId}`);
                    return;
                }

                if (!(await checkUserPermissions(component))) return;

                try {
                    await component.run(client, interaction);
                } catch (err) {
                    error(`[COMPONENT ERROR] ${interaction.customId}:`, err);
                    // Try to notify the user if possible
                    const errorMsg = { content: '❌ An error occurred while processing this interaction.', flags: 64 };
                    if (interaction.deferred) await interaction.editReply(errorMsg).catch(() => {});
                    else if (!interaction.replied) await interaction.reply(errorMsg).catch(() => {});
                }
                return;
            }
        } catch (err) {
            error('[GLOBAL COMPONENT HANDLER]', err);
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
                if (!interaction.deferred && !interaction.replied) {
                    let options = {};
                    if (shouldDefer === 'ephemeral') {
                        options = { flags: 64 };
                    } else if (typeof shouldDefer === 'object') {
                        options = shouldDefer;
                    }
                    await interaction.deferReply(options).catch(() => {});
                }
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
