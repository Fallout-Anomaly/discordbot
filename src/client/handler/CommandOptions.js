
const config = require("../../config");

const application_commands_cooldown = new Map();
const message_commands_cooldown = new Map();

/**
 * 
 * @param {import("discord.js").Interaction} interaction 
 * @param {ApplicationCommand['data']['options']} options 
 * @param {ApplicationCommand['data']['command']} command 
 * @returns {boolean}
 */
const handleApplicationCommandOptions = async (interaction, options, _command) => {
    if (options.botOwner) {
        // Bot Owner commands should ONLY be accessible to the owner, not staff
        // This is critical for security as these commands can shutdown the bot, eval code, etc.
        const isOwner = interaction.user.id === config.users.ownerId;

        if (!isOwner) {
            await interaction.reply({
                content: '❌ You do not have permission to run this command (Bot Owner only).',
                ephemeral: true
            });

            return false;
        }
    }

    if (options.botDevelopers) {
        if (config.users?.developers?.length > 0 && !config.users?.developers?.includes(interaction.user.id)) {
            await interaction.reply({
                content: config.messages.NOT_BOT_DEVELOPER,
                ephemeral: true
            });

            return false;
        }
    }

    if (options.guildOwner) {
        if (interaction.user.id !== interaction.guild.ownerId) {
            await interaction.reply({
                content: config.messages.NOT_GUILD_OWNER,
                ephemeral: true
            });

            return false;
        }
    }

    if (options.cooldown) {
        const cooldownFunction = () => {
            let data = application_commands_cooldown.get(interaction.user.id);

            data.push(interaction.commandName);

            application_commands_cooldown.set(interaction.user.id, data);

            setTimeout(() => {
                let data = application_commands_cooldown.get(interaction.user.id);

                data = data.filter((v) => v !== interaction.commandName);

                if (data.length <= 0) {
                    application_commands_cooldown.delete(interaction.user.id);
                } else {
                    application_commands_cooldown.set(interaction.user.id, data);
                }
            }, options.cooldown);
        }

        if (application_commands_cooldown.has(interaction.user.id)) {
            let data = application_commands_cooldown.get(interaction.user.id);

            if (data.some((cmd) => cmd === interaction.commandName)) {
                const expiredTimestamp = Math.floor((Date.now() + options.cooldown) / 1000);
                await interaction.reply({
                    content: config.messages.GUILD_COOLDOWN.replace(/%cooldown%/g, `<t:${expiredTimestamp}:R>`),
                    ephemeral: true
                });

                return false;
            } else {
                cooldownFunction();
            }
        } else {
            application_commands_cooldown.set(interaction.user.id, [interaction.commandName]);
            cooldownFunction();
        }
    }

    return true;
}

/**
 * 
 * @param {Message} message 
 * @param {MessageCommand['data']['options']} options 
 * @param {MessageCommand['data']['command']} command 
 * @returns {boolean}
 */
const handleMessageCommandOptions = async (message, options, command) => {
    if (options.botOwner) {
        // Bot Owner commands should ONLY be accessible to the owner, not staff
        // This is critical for security as these commands can shutdown the bot, eval code, etc.
        const isOwner = message.author.id === config.users.ownerId;

        if (!isOwner) {
            await message.reply({
                content: config.messages.NOT_BOT_OWNER
            });

            return false;
        }
    }

    if (options.botDevelopers) {
        if (config.users?.developers?.length > 0 && !config.users?.developers?.includes(message.author.id)) {
            await message.reply({
                content: config.messages.NOT_BOT_DEVELOPER
            });

            return false;
        }
    }

    if (options.guildOwner) {
        if (message.author.id !== message.guild.ownerId) {
            await message.reply({
                content: config.messages.NOT_GUILD_OWNER
            });

            return false;
        }
    }

    if (options.nsfw) {
        if (!message.channel.nsfw) {
            await message.reply({
                content: config.messages.CHANNEL_NOT_NSFW
            });

            return false;
        }
    }

    if (options.cooldown) {
        // Map alias to main command name to prevent cooldown bypass
        const mainCommandName = command.name;
        const cooldownFunction = () => {
            let data = message_commands_cooldown.get(message.author.id);

            data.push(mainCommandName);

            message_commands_cooldown.set(message.author.id, data);

            setTimeout(() => {
                let data = message_commands_cooldown.get(message.author.id);

                data = data.filter((cmd) => cmd !== mainCommandName);

                if (data.length <= 0) {
                    message_commands_cooldown.delete(message.author.id);
                } else {
                    message_commands_cooldown.set(message.author.id, data);
                }
            }, options.cooldown);
        }

        if (message_commands_cooldown.has(message.author.id)) {
            let data = message_commands_cooldown.get(message.author.id);

            if (data.some((v) => v === mainCommandName)) {
                const expiredTimestamp = Math.floor((Date.now() + options.cooldown) / 1000);
                await message.reply({
                    content: config.messages.GUILD_COOLDOWN.replace(/%cooldown%/g, `<t:${expiredTimestamp}:R>`)
                });

                return false;
            } else {
                cooldownFunction();
            }
        } else {
            message_commands_cooldown.set(message.author.id, [mainCommandName]);
            cooldownFunction();
        }
    }

    return true;
}

module.exports = { handleApplicationCommandOptions, handleMessageCommandOptions }