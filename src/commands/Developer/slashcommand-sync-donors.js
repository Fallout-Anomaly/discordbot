const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const DonorSystem = require('../../utils/DonorSystem');
const config = require('../../config');

module.exports = new ApplicationCommand({
    command: {
        name: 'sync-donors',
        description: 'Admin: Sync Discord donor/booster roles with database',
        options: [
            {
                name: 'mode',
                description: 'Sync mode',
                type: ApplicationCommandOptionType.String,
                choices: [
                    { name: 'Add missing donors (safe)', value: 'add' },
                    { name: 'Full sync (add + remove)', value: 'full' },
                    { name: 'Dry run (preview only)', value: 'dry' }
                ]
            },
            {
                name: 'tier-mapping',
                description: 'Map roles to tiers (format: roleID:tier,roleID:tier)',
                type: ApplicationCommandOptionType.String
            }
        ]
    },
    options: { botOwner: true },
    run: async (client, interaction) => {
        const staffRoleId = config.roles?.staff_role || process.env.STAFF_ROLE_ID;
        if (!interaction.member.roles.cache.has(staffRoleId)) {
            return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });

        const mode = interaction.options.getString('mode') || 'add';
        const tierMapping = interaction.options.getString('tier-mapping');

        let roleTierMap = {};
        if (tierMapping) {
            tierMapping.split(',').forEach(pair => {
                const [roleId, tier] = pair.split(':');
                if (roleId && tier && DonorSystem.TIERS[tier]) roleTierMap[roleId.trim()] = tier.trim();
            });
        }

        if (Object.keys(roleTierMap).length === 0) {
            const donatorRole = config.users?.donator_role;
            const boosterRole = config.users?.booster_role;
            if (donatorRole) roleTierMap[donatorRole] = 'gold';
            if (boosterRole) roleTierMap[boosterRole] = 'silver';
        }

        if (Object.keys(roleTierMap).length === 0) {
            return interaction.editReply({ content: '❌ No role-to-tier mapping found.\n\nEither configure roles in config.js or provide mapping:\n`/sync-donors tier-mapping:ROLE_ID:bronze,ROLE_ID2:gold`' });
        }

        try {
            // Fetch members in chunks to avoid rate limiting (Discord limit: 1 fetch per second)
            let stats = { scanned: 0, added: 0, updated: 0, removed: 0, skipped: 0 };
            const isDryRun = mode === 'dry';
            const isFullSync = mode === 'full';
            const shouldBeDonors = new Set();

            // Fetch all members but with exponential backoff to avoid rate limits
            console.log('[SYNC DONORS] Starting member fetch...');
            await interaction.guild.members.fetch({ limit: 1000 }).catch(err => {
                if (err.code === 'RESTRateLimited') {
                    console.warn('[SYNC DONORS] Rate limited during fetch, retrying with backoff...');
                }
            });
            
            const members = interaction.guild.members.cache;

            for (const [userId, member] of members) {
                stats.scanned++;
                let highestTier = null;
                let highestPriority = 0;

                for (const [roleId, tier] of Object.entries(roleTierMap)) {
                    if (member.roles.cache.has(roleId)) {
                        const tierPriority = { bronze: 1, silver: 2, gold: 3, platinum: 4 }[tier] || 0;
                        if (tierPriority > highestPriority) {
                            highestTier = tier;
                            highestPriority = tierPriority;
                        }
                    }
                }

                if (highestTier) {
                    shouldBeDonors.add(userId);
                    const existingDonor = await DonorSystem.getDonor(userId);

                    if (!existingDonor) {
                        if (!isDryRun) await DonorSystem.addDonor(userId, highestTier);
                        stats.added++;
                    } else if (existingDonor.tier !== highestTier) {
                        if (!isDryRun) await DonorSystem.addDonor(userId, highestTier, existingDonor.custom_badge);
                        stats.updated++;
                    } else {
                        stats.skipped++;
                    }
                }

                // Add small delay every 10 operations to avoid rate limiting
                if (stats.scanned % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            if (isFullSync) {
                const allDonors = await DonorSystem.getTopDonors(10000);
                for (const donor of allDonors) {
                    if (!shouldBeDonors.has(donor.user_id)) {
                        if (!isDryRun) await DonorSystem.removeDonor(donor.user_id);
                        stats.removed++;
                    }
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(isDryRun ? '🔍 Donor Sync Preview' : '✅ Donor Sync Complete')
                .setDescription(isDryRun ? 'This is a preview. No changes were made.\nRun with mode `add` or `full` to apply changes.' : `Sync mode: **${mode}**`)
                .addFields(
                    { name: 'Members Scanned', value: `${stats.scanned}`, inline: true },
                    { name: 'Donors Added', value: `${stats.added}`, inline: true },
                    { name: 'Tiers Updated', value: `${stats.updated}`, inline: true },
                    { name: 'Unchanged', value: `${stats.skipped}`, inline: true },
                    { name: 'Removed', value: `${stats.removed}`, inline: true },
                    { name: 'Role Mapping', value: Object.entries(roleTierMap).map(([roleId, tier]) => `<@&${roleId}> → ${DonorSystem.TIERS[tier].badge} ${tier}`).join('\n') || 'None' }
                )
                .setColor(isDryRun ? '#3498db' : '#2ecc71')
                .setFooter({ text: isDryRun ? 'Dry run - no changes made' : `Mode: ${mode}` })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[SYNC DONORS] Error:', err);
            return interaction.editReply({ content: `❌ Error syncing donors: ${err.message}` });
        }
    }
}).toJSON();
