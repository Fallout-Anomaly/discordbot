const { ApplicationCommandOptionType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'embed',
        description: 'Create and send a custom embed message.',
        options: [
            {
                name: 'channel',
                description: 'Where to send the embed (defaults to current channel).',
                type: ApplicationCommandOptionType.Channel,
                required: false
            },
            {
                name: 'color',
                description: 'Hex color code (e.g. #ff0000).',
                type: ApplicationCommandOptionType.String,
                required: false
            },
            {
                name: 'image',
                description: 'Big image at the bottom.',
                type: ApplicationCommandOptionType.Attachment,
                required: false
            },
            {
                name: 'thumbnail',
                description: 'Small image at the top right.',
                type: ApplicationCommandOptionType.Attachment,
                required: false
            }
        ],
        defaultMemberPermissions: PermissionFlagsBits.ManageMessages.toString()
    },
    run: async (client, interaction) => {
        // Initialize drafts cache if not exists
        if (!client.embedDrafts) client.embedDrafts = new Map();

        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const color = interaction.options.getString('color');
        const image = interaction.options.getAttachment('image');
        const thumbnail = interaction.options.getAttachment('thumbnail');

        // Verify bot permissions in target channel
        if (!channel.isTextBased()) {
            return interaction.reply({ content: '❌ Target must be a text channel.', ephemeral: true });
        }
        
        // Store the options for retrieval in the modal handler
        // parsing the attachment to just get the URL
        client.embedDrafts.set(interaction.user.id, {
            channelId: channel.id,
            color: color || '#2b2d31', // Default Discord dark/gray
            imageUrl: image ? image.url : null,
            thumbnailUrl: thumbnail ? thumbnail.url : null
        });

        // Create the Modal
        const modal = new ModalBuilder()
            .setCustomId('embed_create')
            .setTitle('Embed Generator');

        const titleInput = new TextInputBuilder()
            .setCustomId('embed_title')
            .setLabel("Title")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Announcement / Information")
            .setRequired(false);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('embed_description')
            .setLabel("Description (Supports Links/Markdown)")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Use [Link Text](URL) for links.\nUse **Bold** for headers.")
            .setRequired(true);

        const footerInput = new TextInputBuilder()
            .setCustomId('embed_footer')
            .setLabel("Footer Text")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Optional footer text...")
            .setRequired(false);

        const firstActionRow = new ActionRowBuilder().addComponents(titleInput);
        const secondActionRow = new ActionRowBuilder().addComponents(descriptionInput);
        const thirdActionRow = new ActionRowBuilder().addComponents(footerInput);

        modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

        await interaction.showModal(modal);
    }
}).toJSON();
