const config = require("../../config");
const { error } = require("../../utils/Console");

class ComponentsListener {
    /**
     * 
     * @param {DiscordBot} client 
     */
    constructor(client) {
        client.on('interactionCreate', async (interaction) => {
            const checkUserPermissions = async (component) => {
                // Use optional chaining to handle messages that weren't from slash commands
                // interaction.message.interaction only exists if the message was a slash command response
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
                    // Try exact match first
                    let component = client.collection.components.buttons.get(interaction.customId);
                    
                    // If no exact match, try regex patterns
                    if (!component) {
                        for (const [pattern, comp] of client.collection.components.buttons) {
                            if (pattern instanceof RegExp && pattern.test(interaction.customId)) {
                                component = comp;
                                break;
                            }
                        }
                    }

                    if (!component) return;

                    if (!(await checkUserPermissions(component))) return;

                    try {
                        // Auto-defer to prevent 3-second timeout on Unknown interaction (10062)
                        if (!interaction.deferred && !interaction.replied) {
                            await interaction.deferReply({ ephemeral: true }).catch(() => {});
                        }
                        component.run(client, interaction);
                    } catch (err) {
                        error(err);
                    }

                    return;
                }

                if (interaction.isAnySelectMenu()) {
                    // Try exact match first
                    let component = client.collection.components.selects.get(interaction.customId);
                    
                    // If no exact match, try regex patterns
                    if (!component) {
                        for (const [pattern, comp] of client.collection.components.selects) {
                            if (pattern instanceof RegExp && pattern.test(interaction.customId)) {
                                component = comp;
                                break;
                            }
                        }
                    }

                    if (!component) return;

                    if (!(await checkUserPermissions(component))) return;

                    try {
                        component.run(client, interaction);
                    } catch (err) {
                        error(err);
                    }

                    return;
                }

                if (interaction.isModalSubmit()) {
                    // Try exact match first
                    let component = client.collection.components.modals.get(interaction.customId);
                    
                    // If no exact match, try regex patterns
                    if (!component) {
                        for (const [pattern, comp] of client.collection.components.modals) {
                            if (pattern instanceof RegExp && pattern.test(interaction.customId)) {
                                component = comp;
                                break;
                            }
                        }
                    }

                    if (!component) return;

                    try {
                        component.run(client, interaction);
                    } catch (err) {
                        error(err);
                    }

                    return;
                }

                if (interaction.isAutocomplete()) {
                    const component = client.collection.components.autocomplete.get(interaction.commandName);

                    if (!component) return;

                    try {
                        component.run(client, interaction);
                    } catch (err) {
                        error(err);
                    }

                    return;
                }
            } catch (err) {
                error(err);
            }
        });
    }
}

module.exports = ComponentsListener;