const Component = require('../../structure/Component');

module.exports = new Component({
    customId: 'verify_member',
    type: 'button',
    options: {
        public: true
    },
    run: async (client, interaction) => {
        const roleId = process.env.MEMBER_ROLE_ID;
        if (!roleId) return interaction.reply({ content: '❌ Verification role is not configured.', flags: 64 });

        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) return interaction.reply({ content: '❌ Verification role not found.', flags: 64 });

        if (interaction.member.roles.cache.has(roleId)) {
            return interaction.reply({ content: '✅ You are already verified!', flags: 64 });
        }

        try {
            // Check if bot can manage roles
            if (!interaction.guild.members.me.permissions.has('ManageRoles')) {
                return interaction.reply({ content: '❌ Bot lacks "Manage Roles" permission.', ephemeral: true });
            }
            if (role.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.reply({ content: '❌ Verification role is higher than bot role.', ephemeral: true });
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
            
            await interaction.reply({ 
                content: successMsg, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('[VERIFY] Error:', error);
            interaction.reply({ content: '❌ An error occurred during verification. Please contact staff.', ephemeral: true });
        }
    }
}).toJSON();
