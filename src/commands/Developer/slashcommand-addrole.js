const { ChatInputCommandInteraction, ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'addrole',
        description: 'Mass add a role to all members who do not have it.',
        type: 1, // ChatInput
        options: [{
            name: 'role',
            description: 'The role to assign to everyone.',
            type: ApplicationCommandOptionType.Role,
            required: true
        }]
    },
    options: {
        botOwner: true
    },
    /**
     * 
     * @param {import("../../client/DiscordBot")} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    run: async (client, interaction) => {
        const role = interaction.options.getRole('role', true);
        
        // Safety check: Don't allow adding dangerous permissions
        if (role.permissions.has('Administrator') || role.permissions.has('ManageGuild')) {
             return interaction.reply({ 
                content: '❌ Safety Catch: You cannot mass-assign a role with Administrator or Manage Guild permissions.',
                ephemeral: true
             });
        }

        await interaction.deferReply({ ephemeral: false });
        await interaction.editReply(`🔄 Fetching members... this might take a moment.`);

        try {
            // Force fetch all members to ensure cache is complete
            const members = await interaction.guild.members.fetch();
            
            // Filter: Humans only, don't have role
            const eligibleMembers = members.filter(m => !m.user.bot && !m.roles.cache.has(role.id));
            
            if (eligibleMembers.size === 0) {
                return interaction.editReply(`✅ No action needed. All ${members.size} non-bot members already have the **${role.name}** role.`);
            }

            await interaction.editReply(`found ${eligibleMembers.size} members to update. Starting process...`);

            let successCount = 0;
            let errorCount = 0;
            let processed = 0;
            const total = eligibleMembers.size;

            // Process in chunks or one-by-one? One-by-one with small delay is safer for API limits.
            // Discord.js handles rate limits, but spamming 7k requests might timeout the connection or cause memory issues if parallelized too much.
            // Sequential is safer.

            for (const [id, member] of eligibleMembers) {
                try {
                    await member.roles.add(role, 'Mass Add Role Command');
                    successCount++;
                } catch (e) {
                    errorCount++;
                    const errorMessage = e.message;
                    // If hierarchy error, stop early? Or just log?
                    // Usually better to count errors.
                    console.error(`[AddRole] Failed for ${member.user.tag}: ${errorMessage}`);
                }
                
                processed++;
                // Update status every 50 members to avoid spamming interaction
                if (processed % 50 === 0) {
                    await interaction.editReply(`🔄 Processing: ${processed}/${total} (` + Math.floor((processed/total)*100) + `%).\nSuccess: ${successCount}\nErrors: ${errorCount}`);
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
                .setFooter({ text: 'Check console for specific error details (usually hierarchy).' })
                .setTimestamp();

            await interaction.editReply({ content: null, embeds: [embed] });

        } catch (e) {
            console.error(e);
            await interaction.editReply(`❌ detailed error: ${e.message}`);
        }
    }
}).toJSON();
