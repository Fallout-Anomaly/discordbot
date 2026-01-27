const Component = require("../../structure/Component");

module.exports = new Component({
    customId: 'example-modal-id',
    type: 'modal',
    /**
     * 
     * @param {DiscordBot} client 
     * @param {ModalSubmitInteraction} interaction 
     */
    run: async (client, interaction) => {

        const field = interaction.fields.getTextInputValue('example-modal-id-field-1');

        await interaction.reply({
            content: 'Hello **' + field + '**.',
            flags: 64
        });

    }
}).toJSON();