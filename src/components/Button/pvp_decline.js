const Component = require('../../structure/Component');

module.exports = new Component({
    customId: 'pvp_decline_*',
    type: 'Button',
    run: async (client, interaction) => {
        // Parse IDs from customId: pvp_decline_{attackerId}_{defenderId}
        const parts = interaction.customId.split('_');
        const attackerId = parts[2];
        const defenderId = parts[3];

        // Verify the button clicker is the defender
        if (interaction.user.id !== defenderId) {
            return interaction.reply({ 
                content: '❌ This challenge is not for you!', 
                flags: 64 
            });
        }

        // Get attacker name
        let attackerName = 'the challenger';
        try {
            const attacker = await client.users.fetch(attackerId);
            attackerName = attacker.username;
        } catch {}

        // Disable buttons and update message
        await interaction.update({ 
            content: `💬 ${interaction.user.username} declined the challenge from ${attackerName}.`,
            embeds: [],
            components: [] 
        });
    }
});
