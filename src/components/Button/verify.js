const Component = require('../../structure/Component');

module.exports = new Component({
    customId: 'verify_member',
    type: 'button',
    options: {
        public: true
    },
    async run(client, interaction) {
        // ✅ FIX: Defer immediately so we can use editReply later
        await interaction.deferReply({ flags: 64 });

        // Already deferred by interactionCreate.js - just use editReply()
        const roleId = process.env.MEMBER_ROLE_ID;
        if (!roleId) return interaction.editReply({ content: '❌ Verification role is not configured.' });

        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) return interaction.editReply({ content: '❌ Verification role not found.' });

        if (interaction.member.roles.cache.has(roleId)) {
            return interaction.editReply({ content: '✅ You are already verified!' });
        }

        try {
            // Check if bot can manage roles
            if (!interaction.guild.members.me.permissions.has('ManageRoles')) {
                return interaction.editReply({ content: '❌ Bot lacks "Manage Roles" permission.' });
            }
            if (role.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.editReply({ content: '❌ Verification role is higher than bot role.' });
            }

            await interaction.member.roles.add(role);

            // Fetch custom message or use default
            let successMsg = client.database.get(`verify_msg_${interaction.guild.id}`);
            
            if (!successMsg) {
                 successMsg = `✅ Success! You have been granted the <@&${roleId}> role. Welcome to the full survivor experience!`;
            }

            // Replace placeholders
            successMsg = successMsg
                .replace(/{user}/g, `<@${interaction.user.id}>`)
                .replace(/{role}/g, `<@&${roleId}>`)
                .replace(/\\n/g, '\n'); // Handle escaped newlines if entered via command
            
            await interaction.editReply({ 
                content: successMsg
            });
        } catch (error) {
            console.error('[VERIFY] Error:', error);
            interaction.editReply({ content: '❌ An error occurred during verification. Please contact staff.' });
        }
    }
}).toJSON();
