const { REST, Routes } = require('discord.js');
const { info, error, success } = require('../../utils/Console');
const { readdirSync } = require('fs');

class CommandsHandler {
    client;

    /**
     *
     * @param {DiscordBot} client 
     */
    constructor(client) {
        this.client = client;
    }

    load = () => {
        // Clear previous array to avoid duplicates during reload/re-init
        this.client.rest_application_commands_array = [];

        for (const directory of readdirSync('./src/commands/')) {
            for (const file of readdirSync('./src/commands/' + directory).filter((f) => f.endsWith('.js'))) {
                try {
                    /**
                     * @type {ApplicationCommand['data'] | MessageCommand['data']}
                     */
                    const module = require('../../commands/' + directory + '/' + file);

                    if (!module) continue;

                    if (module.__type__ === 2) {
                        if (!module.command || !module.run) {
                            error('Unable to load the message command ' + file);
                            continue;
                        }

                        this.client.collection.message_commands.set(module.command.name, module);

                        if (module.command.aliases && Array.isArray(module.command.aliases)) {
                            module.command.aliases.forEach((alias) => {
                                this.client.collection.message_commands_aliases.set(alias, module.command.name);
                            });
                        }

                        info('Loaded new message command: ' + file);
                    } else if (module.__type__ === 1) {
                        if (!module.command || !module.run) {
                            error('Unable to load the application command ' + file);
                            continue;
                        }

                        const commandName = module.command.name || module.command.data?.name;
                        if (!commandName) {
                            error('Unable to determine name for application command ' + file);
                            continue;
                        }

                        this.client.collection.application_commands.set(commandName, module);
                        
                        // Ensure we push a JSON object, not a builder
                        const commandJSON = typeof module.command.toJSON === 'function' ? module.command.toJSON() : module.command;
                        this.client.rest_application_commands_array.push(commandJSON);

                        info('Loaded new application command: ' + file + ' (' + commandName + ')');
                    } else {
                        error('Invalid command type ' + module.__type__ + ' from command file ' + file);
                    }
                } catch (e) {
                    error('Unable to load a command from the path: ' + 'src/commands/' + directory + '/' + file);
                    console.error(e); // Print the actual error!
                }
            }
        }

        success(`Successfully loaded ${this.client.collection.application_commands.size} application commands and ${this.client.collection.message_commands.size} message commands.`);
    }

    reload = () => {
        this.client.collection.message_commands.clear();
        this.client.collection.message_commands_aliases.clear();
        this.client.collection.application_commands.clear();
        this.client.rest_application_commands_array = [];

        this.load();
    }
    
    /**
     * @param {{ enabled: boolean, guildId: string }} development
     * @param {Partial<import('discord.js').RESTOptions>} restOptions 
     */
    registerApplicationCommands = async (development, restOptions = null) => {
        const rest = new REST(restOptions ? restOptions : { version: '10' }).setToken(this.client.token);

        try {
            // We register the commands found in our local codebase.
            // CAUTION: Since a Cloudflare Worker is active, these Slash Commands will NOT work unless the Worker proxies them.
            // However, we run this to ensure any STALE commands (like the broken /addrole) are removed if we deleted the file.
            if (development?.enabled) {
                await rest.put(Routes.applicationGuildCommands(this.client.user.id.toString(), development.guildId.toString()), { body: this.client.rest_application_commands_array });
                success(`Successfully updated ${this.client.rest_application_commands_array.length} local application commands.`);
            } else {
                await rest.put(Routes.applicationCommands(this.client.user.id.toString()), { body: this.client.rest_application_commands_array });
                success(`Successfully updated ${this.client.rest_application_commands_array.length} global application commands.`);
            }
        } catch (err) {
            error('Failed to register application commands: ' + err.message);
            // Clear the array on failure to prevent stale data persisting
            this.client.rest_application_commands_array = [];
        }
    }
}

module.exports = CommandsHandler;