const Component = require('../../structure/Component');

module.exports = new Component({
    customId: 'verify_member',
    type: 'button',
    options: {
        public: true
    },
    run: async (client, interaction) => {
        // 1. Acknowledge immediately
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: 64 }).catch(() => {});
        }

        const roleId = process.env.MEMBER_ROLE_ID;
        if (!roleId) return interaction.editReply({ content: '❌ Verification role is not configured.' }).catch(() => {});

        try {
            // Fetch member and role to ensure we have fresh data
            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => interaction.member);
            const role = await interaction.guild.roles.fetch(roleId).catch(() => null);

            if (!role) return interaction.editReply({ content: '❌ Verification role not found in this server.' }).catch(() => {});

            if (member.roles.cache.has(roleId)) {
                return interaction.editReply({ content: '✅ You are already verified!' }).catch(() => {});
            }

            // Check bot permissions
            const me = await interaction.guild.members.fetchMe().catch(() => interaction.guild.members.me);
            if (!me.permissions.has('ManageRoles')) {
                return interaction.editReply({ content: '❌ Bot lacks "Manage Roles" permission.' }).catch(() => {});
            }
            
            if (role.position >= me.roles.highest.position) {
                return interaction.editReply({ content: '❌ Verification role is higher than the Bot\'s highest role. Please move my role above the verification role.' }).catch(() => {});
            }

            // Assign Role
            await member.roles.add(role);

            // Fetch custom message safely
            let successMsg = null;
            try {
                if (client.database && typeof client.database.get === 'function') {
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
            
            await interaction.editReply({ content: successMsg }).catch(() => {});

        } catch (error) {
            console.error('[VERIFY ERROR]:', error);
            await interaction.editReply({ content: '❌ An error occurred during verification. Please contact staff.' }).catch(() => {});
        }
    }
}).toJSON();
