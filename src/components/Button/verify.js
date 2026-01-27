const Component = require('../../structure/Component');

module.exports = new Component({
    customId: 'verify_member',
    type: 'button',
    options: {
        public: true
    },
    run: async (client, interaction) => {
        // 1. FIX: Explicitly defer the reply so we can use editReply later
        await interaction.deferReply({ flags: 64 });

        const roleId = process.env.MEMBER_ROLE_ID;
        if (!roleId) return interaction.editReply({ content: '❌ Verification role is not configured.' });

        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) return interaction.editReply({ content: '❌ Verification role not found in this server.' });

        if (interaction.member.roles.cache.has(roleId)) {
            return interaction.editReply({ content: '✅ You are already verified!' });
        }

        try {
            // Check if bot can manage roles
            if (!interaction.guild.members.me.permissions.has('ManageRoles')) {
                return interaction.editReply({ content: '❌ Bot lacks "Manage Roles" permission.' });
            }
            if (role.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.editReply({ content: '❌ Verification role is higher than the Bot\'s highest role.' });
            }

            // Assign Role
            await interaction.member.roles.add(role);

            // Fetch custom message safely
            let successMsg = null;
            try {
                if (client.database && typeof client.database.get === 'function') {
                    // QuickYAML is synchronous and uses Key-Value
                    successMsg = client.database.get(`verify_msg_${interaction.guild.id}`);
                }
            } catch (dbErr) {
                console.warn('Database read error in verify.js, using default message.', dbErr);
            }
            
            if (!successMsg) {
                 successMsg = `✅ Success! You have been granted the <@&${roleId}> role. Welcome to the wasteland!`;
            }

            // Replace placeholders
            successMsg = successMsg
                .replace(/{user}/g, `<@${interaction.user.id}>`)
                .replace(/{role}/g, `<@&${roleId}>`)
                .replace(/\\n/g, '\n'); 
            
            await interaction.editReply({ content: successMsg });

        } catch (error) {
            console.error('[VERIFY] Error:', error);
            await interaction.editReply({ content: '❌ An error occurred during verification. Please contact staff.' });
        }
    }
}).toJSON();
