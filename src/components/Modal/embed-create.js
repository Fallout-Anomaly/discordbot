const { EmbedBuilder } = require("discord.js");
const Component = require("../../structure/Component");

module.exports = new Component({
    customId: 'embed_create',
    type: 'modal',
    run: async (client, interaction) => {
        // Retrieve temporary data stored during the slash command
        const draft = client.embedDrafts?.get(interaction.user.id);

        if (!draft) {
            return interaction.reply({ 
                content: '❌ Session expired. Please run `/embed` again.', 
                flags: 64
            });
        }

        const title = interaction.fields.getTextInputValue('embed_title');
        const description = interaction.fields.getTextInputValue('embed_description');
        const footer = interaction.fields.getTextInputValue('embed_footer');

        const embed = new EmbedBuilder()
            .setDescription(description)
            .setColor(draft.color);

        if (title) embed.setTitle(title);
        if (footer) embed.setFooter({ text: footer });
        if (draft.imageUrl) embed.setImage(draft.imageUrl);
        if (draft.thumbnailUrl) embed.setThumbnail(draft.thumbnailUrl);

        try {
            const channel = await client.channels.fetch(draft.channelId);
            if (!channel) {
                 return interaction.reply({ content: '❌ Target channel not found.', flags: 64 });
            }

            // Send the embed
            await channel.send({ embeds: [embed] });

            // Confirm to user
            await interaction.reply({ 
                content: `✅ Embed sent to ${channel}!`, 
                flags: 64
            });

            // Cleanup
            client.embedDrafts.delete(interaction.user.id);

        } catch (err) {
            console.error(err);
            await interaction.reply({ 
                content: `❌ Failed to send embed: ${err.message}`, 
                flags: 64
            });
        }
    }
});
