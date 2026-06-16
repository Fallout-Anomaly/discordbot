const { ApplicationCommandOptionType, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const { warn, error } = require("../../utils/Console");

module.exports = new ApplicationCommand({
    command: {
        name: 'addrole',
        description: 'Mass add a role to all members who do not have it.',
        options: [
            {
                name: 'role',
                description: 'The role to assign.',
                type: ApplicationCommandOptionType.Role,
                required: true
            }
        ],
        defaultMemberPermissions: PermissionFlagsBits.Administrator.toString()
    },
    options: {
        botOwner: true 
    },
    /**
     * 
     * @param {import("../../client/DiscordBot")} client 
     * @param {import("discord.js").ChatInputCommandInteraction} interaction 
     */
    run: async (client, interaction) => {
        const role = interaction.options.getRole('role');

        if (role.permissions.has(PermissionFlagsBits.Administrator) || role.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                 content: '❌ Safety Catch: You cannot mass-assign a role with Administrator or Manage Guild permissions.',
                 flags: 64
            });
        }

        // 1. Defer immediately to avoid timeout
        await interaction.deferReply();

        // Preflight: confirm the bot can actually assign this role before we
        // hammer the API with N calls that would all fail.
        const me = interaction.guild.members.me ?? await interaction.guild.members.fetchMe().catch(() => null);
        if (!me || !me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.editReply('❌ I need the **Manage Roles** permission to do this.');
        }
        if (role.managed) {
            return interaction.editReply(`❌ **${role.name}** is managed by an integration (bot/booster role) and cannot be assigned manually.`);
        }
        if (role.position >= me.roles.highest.position) {
            return interaction.editReply(`❌ **${role.name}** is higher than or equal to my highest role. Move my role above it in **Server Settings → Roles**, then try again.`);
        }
        if (role.id === interaction.guild.id) {
            return interaction.editReply('❌ That is the @everyone role — it cannot be assigned.');
        }

        try {
            // 2. Try to use cache first
            let members = interaction.guild.members.cache;
            
            // 3. If cache is incomplete, fetch missing members
            if (members.size < interaction.guild.memberCount) {
                await interaction.editReply(`🔄 Cached ${members.size}/${interaction.guild.memberCount} members. Fetching the rest...`);
                try {
                    members = await interaction.guild.members.fetch({ time: 60000 }); // 60s timeout
                } catch (err) {
                    warn('Failed to fetch all members, proceeding with cached members:', err);
                }
            }

            const eligibleMembers = members.filter(m => !m.user.bot && !m.roles.cache.has(role.id));
            
            if (eligibleMembers.size === 0) {
                return interaction.editReply(`✅ No action needed. All ${members.size} non-bot members already have the **${role.name}** role.`);
            }

            await interaction.editReply(`Found ${eligibleMembers.size} eligible members. Starting assignment...`);

            let successCount = 0;
            let errorCount = 0;
            let processed = 0;
            const total = eligibleMembers.size;

            // Convert map values to array for iteration
            const memberArray = Array.from(eligibleMembers.values());

            for (const member of memberArray) {
                try {
                    await member.roles.add(role, 'Mass Add Role Command');
                    successCount++;
                } catch (e) {
                    errorCount++;
                    error(`[AddRole] Failed for ${member.user.tag}: ${e.message}`);
                }
                
                processed++;
                
                // Update status every 50 members with error handling
                if (processed % 50 === 0) {
                    try {
                        await interaction.editReply(`🔄 Processing: ${processed}/${total}.\nSuccess: ${successCount}\nErrors: ${errorCount}`);
                    } catch (statusErr) {
                        // Interaction token expired (15 min timeout), send to channel instead
                        if (statusErr.code === 10062 || statusErr.code === 40060) {
                            await interaction.channel.send({
                                content: `🔄 **Mass Role Assignment In Progress**\n\nProcessing: ${processed}/${total}\nSuccess: ${successCount}\nErrors: ${errorCount}`
                            }).catch(() => {});
                        }
                    }
                    
                    // Throttle: Add a small delay to respect rate limits (e.g., 1000ms every 50 members)
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Mass Role Assignment Complete')
                .setColor('#2ecc71')
                .addFields(
                    { name: 'Role', value: `<@&${role.id}>`, inline: true },
                    { name: 'Total Targeted', value: `${total}`, inline: true },
                    { name: 'Success', value: `${successCount}`, inline: true },
                    { name: 'Failed', value: `${errorCount}`, inline: true }
                )
                .setTimestamp();

            try {
                await interaction.editReply({ content: null, embeds: [embed] });
            } catch (finalErr) {
                // Interaction expired, send as channel message
                if (finalErr.code === 10062 || finalErr.code === 40060) {
                    await interaction.channel.send({
                        content: `✅ **Mass Role Assignment Complete**\n\n✅ Successfully added <@&${role.id}> to **${successCount}/${total}** members.\n❌ Failed: ${errorCount}`
                    }).catch(() => {});
                } else {
                    throw finalErr;
                }
            }

        } catch (e) {
            error(e);
            await interaction.editReply(`❌ detailed error: ${e.message}`);
        }
    }
}).toJSON();
