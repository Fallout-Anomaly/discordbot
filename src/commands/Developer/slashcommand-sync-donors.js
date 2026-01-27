const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Command = require('../../structure/MessageCommand');
const DonorSystem = require('../../utils/DonorSystem');
const config = require('../../config');

module.exports = new Command({
    data: new SlashCommandBuilder()
        .setName('sync-donors')
        .setDescription('Admin: Sync Discord donor/booster roles with database')
        .addStringOption(opt => opt
            .setName('mode')
            .setDescription('Sync mode')
            .setRequired(false)
            .addChoices(
                { name: 'Add missing donors (safe)', value: 'add' },
                { name: 'Full sync (add + remove)', value: 'full' },
                { name: 'Dry run (preview only)', value: 'dry' }
            )
        )
        .addStringOption(opt => opt
            .setName('tier-mapping')
            .setDescription('Map roles to tiers (format: roleID:tier,roleID:tier)')
        ),
    
    async run(interaction) {
        // Check if user is staff
        const staffRoleId = config.roles?.staff_role || process.env.STAFF_ROLE_ID;
        if (!interaction.member.roles.cache.has(staffRoleId)) {
            return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const mode = interaction.options.getString('mode') || 'add';
        const tierMapping = interaction.options.getString('tier-mapping');

        // Default role to tier mapping
        let roleTierMap = {};
        
        // Parse custom tier mapping if provided
        if (tierMapping) {
            tierMapping.split(',').forEach(pair => {
                const [roleId, tier] = pair.split(':');
                if (roleId && tier && DonorSystem.TIERS[tier]) {
                    roleTierMap[roleId.trim()] = tier.trim();
                }
            });
        }

        // Default mapping if none provided
        if (Object.keys(roleTierMap).length === 0) {
            // You can configure these in config.js or use defaults
            const donatorRole = config.users?.donator_role;
            const boosterRole = config.users?.booster_role;
            
            if (donatorRole) roleTierMap[donatorRole] = 'gold';
            if (boosterRole) roleTierMap[boosterRole] = 'silver';
        }

        if (Object.keys(roleTierMap).length === 0) {
            return interaction.editReply({
                content: '❌ No role-to-tier mapping found.\n\nEither configure roles in config.js or provide mapping:\n`/sync-donors tier-mapping:ROLE_ID:bronze,ROLE_ID2:gold`'
            });
        }

        try {
            // Fetch all guild members
            await interaction.guild.members.fetch();
            const members = interaction.guild.members.cache;

            let stats = {
                scanned: 0,
                added: 0,
                updated: 0,
                removed: 0,
                skipped: 0
            };

            const isDryRun = mode === 'dry';
            const isFullSync = mode === 'full';

            // Track all users who should be donors (have donor roles)
            const shouldBeDonors = new Set();

            // Scan all members for donor roles
            for (const [userId, member] of members) {
                stats.scanned++;

                let highestTier = null;
                let highestPriority = 0;

                // Check which donor roles they have
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
                        // Add new donor
                        if (!isDryRun) {
                            await DonorSystem.addDonor(userId, highestTier);
                        }
                        stats.added++;
                    } else if (existingDonor.tier !== highestTier) {
                        // Update tier
                        if (!isDryRun) {
                            await DonorSystem.addDonor(userId, highestTier, existingDonor.custom_badge);
                        }
                        stats.updated++;
                    } else {
                        stats.skipped++;
                    }
                }
            }

            // Remove donors who no longer have roles (only in full sync mode)
            if (isFullSync) {
                const allDonors = await DonorSystem.getTopDonors(10000);
                
                for (const donor of allDonors) {
                    if (!shouldBeDonors.has(donor.user_id)) {
                        if (!isDryRun) {
                            await DonorSystem.removeDonor(donor.user_id);
                        }
                        stats.removed++;
                    }
                }
            }

            // Build report embed
            const embed = new EmbedBuilder()
                .setTitle(isDryRun ? '🔍 Donor Sync Preview' : '✅ Donor Sync Complete')
                .setDescription(
                    isDryRun 
                        ? 'This is a preview. No changes were made.\nRun with mode `add` or `full` to apply changes.'
                        : `Sync mode: **${mode}**`
                )
                .addFields(
                    { name: 'Members Scanned', value: `${stats.scanned}`, inline: true },
                    { name: 'Donors Added', value: `${stats.added}`, inline: true },
                    { name: 'Tiers Updated', value: `${stats.updated}`, inline: true },
                    { name: 'Unchanged', value: `${stats.skipped}`, inline: true },
                    { name: 'Removed', value: `${stats.removed}`, inline: true },
                    { name: 'Role Mapping', value: Object.entries(roleTierMap).map(([roleId, tier]) => 
                        `<@&${roleId}> → ${DonorSystem.TIERS[tier].badge} ${tier}`
                    ).join('\n') || 'None' }
                )
                .setColor(isDryRun ? '#3498db' : '#2ecc71')
                .setFooter({ text: isDryRun ? 'Dry run - no changes made' : `Mode: ${mode}` })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[SYNC DONORS] Error:', err);
            return interaction.editReply({ 
                content: `❌ Error syncing donors: ${err.message}` 
            });
        }
    }
});
