const { ApplicationCommandOptionType, PermissionFlagsBits } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'timeout',
        description: 'Put a user in timeout (moderate).',
        options: [
            {
                name: 'user',
                description: 'The user to timeout',
                type: ApplicationCommandOptionType.User,
                required: true
            },
            {
                name: 'duration',
                description: 'Duration in minutes',
                type: ApplicationCommandOptionType.Integer,
                required: true
            },
            {
                name: 'reason',
                description: 'Reason for the timeout',
                type: ApplicationCommandOptionType.String,
                required: false
            }
        ],
        defaultMemberPermissions: PermissionFlagsBits.ModerateMembers.toString()
    },
    run: async (client, interaction) => {
        const user = interaction.options.getUser('user');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

        // Role hierarchy checks to ensure executor outranks target (unless executor is server owner)
        if (member.id === interaction.guild.ownerId) {
            return interaction.reply({ content: '❌ You cannot punish the server owner.', ephemeral: true });
        }
        if (interaction.user.id !== interaction.guild.ownerId &&
            interaction.member.roles.highest.position <= member.roles.highest.position) {
            return interaction.reply({ 
                content: '❌ You cannot punish a member with an equal or higher role than yourself.', 
                ephemeral: true 
            });
        }

        if (!member.moderatable) return interaction.reply({ content: '❌ I cannot timeout this user.', ephemeral: true });

        try {
            await member.timeout(duration * 60 * 1000, reason);
            await interaction.reply({ content: `✅ **${user.tag}** has been timed out for ${duration} minutes. Reason: ${reason}` });
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: '❌ Failed to timeout user.', ephemeral: true });
        }
    }
}).toJSON();
