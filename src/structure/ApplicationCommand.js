

class ApplicationCommand {
    data;

    /**
     *
     * @param {{command: import("discord.js").APIApplicationCommand, options?: Partial<{ cooldown: number, botOwner: boolean, guildOwner: boolean, botDevelopers: boolean }>, run: import("discord.js").Awaitable<(client: DiscordBot, interaction: import('discord.js').Interaction) => void> }} structure 
     */
    constructor(structure) {
        this.data = {
            __type__: 1, // This used for the handler
            ...structure
        }
    }

    toJSON = () => {
        const data = { ...this.data };
        if (data.command && typeof data.command.defaultMemberPermissions !== 'undefined') {
            data.command.defaultMemberPermissions = data.command.defaultMemberPermissions.toString();
        }
        return data;
    }
}

module.exports = ApplicationCommand;
