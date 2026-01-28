const { ApplicationCommandOptionType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'setup-verify',
        description: 'Post the verification message in the current channel.',
        defaultMemberPermissions: PermissionFlagsBits.Administrator.toString(),
        options: [
            {
                name: 'success_message',
                description: 'Message sent after verification. Use {user} and {role} placeholders.',
                type: ApplicationCommandOptionType.String,
                required: false
            },
            {
                name: 'embed_description',
                description: 'Custom text for the verification embed.',
                type: ApplicationCommandOptionType.String,
                required: false
            }
        ]
    },
    run: async (client, interaction) => {
        const successMsg = interaction.options.getString('success_message');
        const embedDesc = interaction.options.getString('embed_description') || 'Welcome to the server! Click the button below to verify yourself and gain access to the rest of the channels.';

        // Save custom success message if provided
        if (successMsg) {
            client.database.set(`verify_msg_${interaction.guild.id}`, successMsg);
        }

        const embed = new EmbedBuilder()
            .setTitle('🛡️ Server Verification')
            .setDescription(embedDesc)
            .setColor('#27ae60')
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_member')
                    .setLabel('Verify Me')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );

        await interaction.reply({ content: `✅ Verification setup sent.${successMsg ? ' Custom success message saved.' : ''}`, flags: 64 });
        await interaction.channel.send({ embeds: [embed], components: [row] });
    }
}).toJSON();
