const { ApplicationCommandOptionType, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

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
                 ephemeral: true
            });
        }

        // 1. Defer immediately to avoid timeout
        await interaction.deferReply();

        try {
            // 2. Try to use cache first
            let members = interaction.guild.members.cache;
            
            // 3. If cache is incomplete, fetch missing members
            if (members.size < interaction.guild.memberCount) {
                await interaction.editReply(`🔄 Cached ${members.size}/${interaction.guild.memberCount} members. Fetching the rest...`);
                try {
                    members = await interaction.guild.members.fetch({ time: 60000 }); // 60s timeout
                } catch (err) {
                    console.warn('Failed to fetch all members, proceeding with cached members:', err);
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
                    console.error(`[AddRole] Failed for ${member.user.tag}: ${e.message}`);
                }
                
                processed++;
                
                // Update status every 50 members
                if (processed % 50 === 0) {
                    await interaction.editReply(`🔄 Processing: ${processed}/${total}.\nSuccess: ${successCount}\nErrors: ${errorCount}`);
                    
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

            await interaction.editReply({ content: null, embeds: [embed] });

        } catch (e) {
            console.error(e);
            await interaction.editReply(`❌ detailed error: ${e.message}`);
        }
    }
}).toJSON();
