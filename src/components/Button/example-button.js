const Component = require("../../structure/Component");

module.exports = new Component({
    customId: 'example-button-id',
    type: 'button',
    /**
     * 
     * @param {DiscordBot} client 
     * @param {ButtonInteraction} interaction 
     */
    run: async (client, interaction) => {
        await interaction.deferReply({ flags: 64 });
        await interaction.editReply({
            content: 'Replied from a Button interaction!'
        });
    }
});