const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const config = require('../../config');

module.exports = new ApplicationCommand({
    command: {
        name: 'fix-buttons',
        description: 'Retroactively add feedback buttons to active support threads (Dev/Staff Only)',
        options: []
    },
    run: async (client, interaction) => {
        // Permission Check
        const staffRoleId = config.roles?.staff_role || process.env.STAFF_ROLE_ID;
        const isDev = config.users.developers.includes(interaction.user.id);
        const isStaff = interaction.member.roles.cache.has(staffRoleId);

        if (!isDev && !isStaff) {
            return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });

        const forumChannelIds = config.channels.forum_support;
        let stats = {
            processed: 0,
            updated: 0,
            skipped: 0,
            errors: 0
        };

        for (const channelId of forumChannelIds) {
            try {
                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (!channel || channel.type !== ChannelType.GuildForum) continue;

                // Fetch active threads
                const activeThreads = await channel.threads.fetch({ active: true });
                
                for (const [threadId, thread] of activeThreads.threads) {
                    if (thread.locked || thread.archived) continue;

                    stats.processed++;

                    try {
                        // Fetch starter message to define the "OP"
                        const starterMessage = await thread.fetchStarterMessage().catch(() => null);
                        if (!starterMessage) {
                            // Can't verify OP without starter message
                            stats.skipped++;
                            continue;
                        }

                        // Search for the Bot's AI response
                        const messages = await thread.messages.fetch({ limit: 20 });
                        const botResponse = messages.find(m => 
                            m.author.id === client.user.id && 
                            m.embeds.length > 0 && 
                            (m.embeds[0].title === '☢️ Anomaly AI Assistant' || m.embeds[0].title?.includes('Anomaly AI Assistant'))
                        );

                        if (botResponse) {
                            // Check if buttons already exist
                            if (botResponse.components.length > 0) {
                                stats.skipped++;
                                continue;
                            }

                            // Create buttons pointing to the Starter Message (OP)
                            const feedbackRow = new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`feedback_worked_${starterMessage.id}`)
                                        .setLabel('✅ That Worked!')
                                        .setStyle(ButtonStyle.Success),
                                    new ButtonBuilder()
                                        .setCustomId(`feedback_failed_${starterMessage.id}`)
                                        .setLabel('❌ That Didn\'t Work')
                                        .setStyle(ButtonStyle.Danger)
                                );

                            await botResponse.edit({ components: [feedbackRow] });
                            stats.updated++;
                        } else {
                            stats.skipped++;
                        }
                    } catch (err) {
                        console.error(`Error processing thread ${thread.name}:`, err);
                        stats.errors++;
                    }
                }
            } catch (err) {
                console.error(`Error processing channel ${channelId}:`, err);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('🔧 Feedback Buttons Retrofit')
            .setDescription(`Processed active support threads in configured forums.`)
            .addFields(
                { name: '🔍 Scanned Threads', value: stats.processed.toString(), inline: true },
                { name: '✅ Updated', value: stats.updated.toString(), inline: true },
                { name: '⏭️ Skipped', value: stats.skipped.toString(), inline: true },
                { name: '⚠️ Errors', value: stats.errors.toString(), inline: true }
            )
            .setColor('#2ecc71')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
});
