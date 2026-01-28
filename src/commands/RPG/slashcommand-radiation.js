const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const db = require('../../utils/EconomyDB');

module.exports = new ApplicationCommand({
    command: {
        name: 'radiation',
        description: 'Check your radiation level (or heal it with items)',
        options: [
            {
                name: 'action',
                description: 'View radiation or heal',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { name: 'Check Radiation Level', value: 'check' },
                    { name: 'Use Rad-Away', value: 'radaway' },
                    { name: 'Use Buffout', value: 'buffout' }
                ]
            }
        ]
    },
    cooldown: 5,
    run: async (client, interaction) => {
        await interaction.deferReply({ flags: 64 });
        const userId = interaction.user.id;
        const action = interaction.options.getString('action');

        // Get or create radiation data
        const userData = await new Promise((resolve) => {
            db.get('SELECT radiation FROM users WHERE id = ?', [userId], (err, row) => {
                resolve(row || { radiation: 0 });
            });
        });

        const currentRadiation = userData.radiation || 0;

        if (action === 'check') {
            let status = '🟢 Safe';
            let statusColor = '#00AA00';
            let effect = 'None';

            if (currentRadiation > 0 && currentRadiation <= 25) {
                status = '🟡 Exposed';
                statusColor = '#FFAA00';
                effect = '-5% Health/Hour';
            } else if (currentRadiation > 25 && currentRadiation <= 50) {
                status = '🟠 Irradiated';
                statusColor = '#FF6600';
                effect = '-10% Health/Hour';
            } else if (currentRadiation > 50 && currentRadiation <= 75) {
                status = '🔴 Heavily Irradiated';
                statusColor = '#FF3300';
                effect = '-20% Health/Hour';
            } else if (currentRadiation > 75) {
                status = '⚫ Critical';
                statusColor = '#660000';
                effect = '-50% Health/Hour (CRITICAL!)';
            }

            const embed = new EmbedBuilder()
                .setTitle('☢️ Radiation Level')
                .setDescription(`**${interaction.user.username}'s** Geiger Counter Reading`)
                .addFields(
                    { name: 'Current Level', value: `**${currentRadiation}%**`, inline: true },
                    { name: 'Status', value: status, inline: true },
                    { name: 'Health Effect', value: effect, inline: false }
                )
                .setColor(statusColor)
                .setFooter({ text: 'Use /radiation heal to reduce radiation' });

            if (currentRadiation > 0) {
                embed.addFields(
                    { name: 'Remedies', value: '• Rad-Away: -50% radiation\n• Buffout: -25% + +25% Damage\n• Rest in Vault: -5%/hour (passive)' }
                );
            }

            return interaction.editReply({ embeds: [embed] });
        }

        // Heal actions
        let healAmount = 0;
        let itemName = '';
        let effect = '';
        let itemId = '';

        if (action === 'radaway') {
            healAmount = 50;
            itemName = 'Rad-Away';
            itemId = 'radaway';
            effect = '☢️ -50% radiation';
        } else if (action === 'buffout') {
            healAmount = 25;
            itemName = 'Buffout';
            itemId = 'buffout';
            effect = '💪 -25% radiation + 25% Damage Resistance (8 hours)';
        }

        if (currentRadiation <= 0) {
            return interaction.editReply({ 
                content: '✅ You are not irradiated. No need to use ' + itemName 
            });
        }

        // Check if player has the item in inventory
        const invData = await new Promise((resolve) => {
            db.get(
                'SELECT amount FROM inventory WHERE user_id = ? AND item_id = ?',
                [userId, itemId],
                (err, row) => resolve(row || { amount: 0 })
            );
        });

        if (invData.amount <= 0) {
            return interaction.editReply({ 
                content: `❌ You don't have **${itemName}** in your inventory!\nVisit \`/shop view consumable\` to purchase one.` 
            });
        }

        const newRadiation = Math.max(0, currentRadiation - healAmount);

        // Remove 1 item from inventory and update radiation
        await new Promise((resolve) => {
            db.serialize(() => {
                // Update radiation
                db.run('UPDATE users SET radiation = ? WHERE id = ?', 
                    [newRadiation, userId], () => {});
                
                // Remove item from inventory
                db.run(
                    'UPDATE inventory SET amount = amount - 1 WHERE user_id = ? AND item_id = ? AND amount > 0',
                    [userId, itemId],
                    () => resolve(),
                { name: 'Remaining Items', value: `**${Math.max(0, invData.amount - 1)}x** left in inventory` }
                );
            });
        });

        const embed = new EmbedBuilder()
            .setTitle(`💊 Used ${itemName}`)
            .setDescription(`${interaction.user.username} used **${itemName}**!`)
            .addFields(
                { name: 'Previous Radiation', value: `**${currentRadiation}%**`, inline: true },
                { name: 'New Radiation', value: `**${newRadiation}%**`, inline: true },
                { name: 'Effect', value: effect }
            )
            .setColor('#00FF00')
            .setFooter({ text: 'Stay safe in the Wasteland!' });

        return interaction.editReply({ embeds: [embed] });
    }
}).toJSON();
