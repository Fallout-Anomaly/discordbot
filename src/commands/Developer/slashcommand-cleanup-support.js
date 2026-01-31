const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");
const config = require("../../config");
const SupportUtil = require("../../utils/SupportUtil");

module.exports = new ApplicationCommand({
    command: {
        name: 'cleanup-support',
        description: 'Manage inactive support threads: send follow-ups and auto-close unresponsive threads.',
        options: [
            {
                name: 'action',
                description: 'Action to perform',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { name: 'Send Follow-ups (7+ days inactive)', value: 'followup' },
                    { name: 'Close Stale Threads (24h+ after follow-up)', value: 'close' },
                    { name: 'Both (Follow-up & Close)', value: 'both' }
                ]
            },
            {
                name: 'limit',
                description: 'Max threads to process per forum (default 50)',
                type: ApplicationCommandOptionType.Integer,
                required: false
            },
            {
                name: 'min_age',
                description: 'Minimum days of inactivity to force close (default 14)',
                type: ApplicationCommandOptionType.Integer,
                required: false,
                minValue: 1
            }
        ]
    },
    options: {
        botOwner: true
    },
    defer: { flags: 64 },
    run: async (client, interaction) => {
        // Interaction is auto-deferred via defer property in handler

        const action = interaction.options.getString('action');
        const limit = interaction.options.getInteger('limit') || 50;
        const minAge = interaction.options.getInteger('min_age') || 14;

        const forumChannels = config.channels.forum_support || [];
        if (forumChannels.length === 0) {
            return interaction.editReply({ content: '❌ No forum support channels configured in config.js.' });
        }

        await interaction.editReply({ content: `🔍 Scanning forum threads for cleanup (action: ${action}, min_age: ${minAge} days)...` });

        const stats = await SupportUtil.runCleanupCycle(client, { action, limit, minAge });

        const embed = new EmbedBuilder()
            .setTitle('🧹 Support Cleanup Complete')
            .setDescription(`Finished processing forum threads.`)
            .addFields(
                { name: '📊 Threads Scanned', value: `${stats.scanned}`, inline: true },
                { name: '📬 Follow-ups Sent', value: `${stats.followups}`, inline: true },
                { name: '🔒 Threads Closed', value: `${stats.closed}`, inline: true },
                { name: '⚠️ Errors', value: `${stats.errors}`, inline: true }
            )
            .setColor('#2ecc71')
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed] });
    }
}).toJSON();


