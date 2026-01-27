const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const db = require('../../utils/EconomyDB');

module.exports = new ApplicationCommand({
    command: {
        name: 'protection',
        description: 'Manage your caps protection and bodyguard services.',
        options: [
            {
                name: 'action',
                description: 'What action to perform',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { name: 'status', value: 'status' },
                    { name: 'hire-bodyguard', value: 'hire' },
                    { name: 'buy-insurance', value: 'insurance' }
                ]
            },
            {
                name: 'duration',
                description: 'Hours of protection (1, 4, or 8)',
                type: ApplicationCommandOptionType.Integer,
                required: false,
                choices: [
                    { name: '1 hour', value: 1 },
                    { name: '4 hours', value: 4 },
                    { name: '8 hours', value: 8 }
                ]
            }
        ]
    },
    run: async (client, interaction) => {
        const action = interaction.options.getString('action');
        const userId = interaction.user.id;
        const duration = interaction.options.getInteger('duration') || 1;

        // Ensure deferred for async operations
        await interaction.deferReply({ flags: 64 });

        // Get user data
        const userData = await new Promise((resolve) => {
            db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                resolve(row || { id: userId, balance: 0, protection_expires: 0, insurance_level: 0 });
            });
        });

        if (action === 'status') {
            const now = Date.now();
            const isProtected = userData.protection_expires && userData.protection_expires > now;
            const protectionRemaining = isProtected ? 
                Math.ceil((userData.protection_expires - now) / 3600000) : 0;

            const insuranceLevel = userData.insurance_level || 0;
            const insuranceNames = ['None', 'Basic', 'Standard', 'Premium'];
            const insuranceProtection = [0, 10, 25, 40]; // % of caps protected

            const embed = new EmbedBuilder()
                .setTitle('🛡️ Your Protection Status')
                .setDescription(`View and manage your caps security.`)
                .addFields(
                    { 
                        name: '💵 Current Balance', 
                        value: `**${userData.balance} Caps**`, 
                        inline: true 
                    },
                    { 
                        name: '💂 Bodyguard Protection', 
                        value: isProtected 
                            ? `✅ Active (${protectionRemaining}h remaining)`
                            : '❌ Not active', 
                        inline: true 
                    },
                    { 
                        name: '📋 Insurance Plan', 
                        value: `**${insuranceNames[insuranceLevel]}** (${insuranceProtection[insuranceLevel]}% protected)`, 
                        inline: true 
                    },
                    { 
                        name: '📊 Protection Benefits', 
                        value: `• Bodyguards reduce robbery success by **30%**\n• Insurance protects **${insuranceProtection[insuranceLevel]}%** of your caps\n• Combined: Both protections stack!`, 
                        inline: false 
                    },
                    { 
                        name: '💰 Pricing', 
                        value: `**Bodyguard:** 50 caps/hr (1h, 4h, 8h options)\n**Insurance:** 100→500 caps (one-time per tier)`, 
                        inline: false 
                    }
                )
                .setColor('#4CAF50')
                .setFooter({ text: 'Stay safe, vault dweller!' });

            return interaction.editReply({ embeds: [embed] });
        }

        if (action === 'hire') {
            const costs = { 1: 50, 4: 180, 8: 320 }; // Slight bulk discount
            const cost = costs[duration];

            if (userData.balance < cost) {
                return interaction.editReply({ 
                    content: `❌ You need **${cost} Caps** to hire bodyguards for ${duration}h. You only have **${userData.balance} Caps**.` 
                });
            }

            const now = Date.now();
            const protectionDuration = duration * 3600000; // Convert hours to milliseconds
            const newExpiry = Math.max(userData.protection_expires || 0, now) + protectionDuration;

            await new Promise((resolve) => {
                db.run(
                    'UPDATE users SET balance = balance - ?, protection_expires = ? WHERE id = ?',
                    [cost, newExpiry, userId],
                    () => resolve()
                );
            });

            const embed = new EmbedBuilder()
                .setTitle('💂 Bodyguards Hired!')
                .setDescription(`You now have armed bodyguards protecting your caps.`)
                .addFields(
                    { name: '💰 Cost', value: `**${cost} Caps**`, inline: true },
                    { name: '⏱️ Duration', value: `**${duration} Hour(s)**`, inline: true },
                    { name: '🎯 Effect', value: `**-30% robbery success chance**`, inline: false },
                    { name: '📊 New Balance', value: `**${userData.balance - cost} Caps**`, inline: false }
                )
                .setColor('#FFD700')
                .setFooter({ text: 'Protection active until protection expires!' });

            return interaction.editReply({ embeds: [embed] });
        }

        if (action === 'insurance') {
            const currentLevel = userData.insurance_level || 0;

            if (currentLevel >= 3) {
                return interaction.editReply({ 
                    content: '❌ You already have Premium insurance! This is the highest tier.' 
                });
            }

            const insuranceCosts = [0, 100, 250, 500]; // Cost for each tier
            const nextLevel = currentLevel + 1;
            const cost = insuranceCosts[nextLevel];

            if (userData.balance < cost) {
                return interaction.editReply({ 
                    content: `❌ You need **${cost} Caps** for the next insurance tier. You only have **${userData.balance} Caps**.` 
                });
            }

            await new Promise((resolve) => {
                db.run(
                    'UPDATE users SET balance = balance - ?, insurance_level = ? WHERE id = ?',
                    [cost, nextLevel, userId],
                    () => resolve()
                );
            });

            const insuranceNames = ['None', 'Basic', 'Standard', 'Premium'];
            const insuranceProtection = [0, 10, 25, 40];

            const embed = new EmbedBuilder()
                .setTitle('📋 Insurance Upgraded!')
                .setDescription(`Your insurance coverage has been improved.`)
                .addFields(
                    { name: '📊 New Plan', value: `**${insuranceNames[nextLevel]}**`, inline: true },
                    { name: '🛡️ Protection', value: `**${insuranceProtection[nextLevel]}% of caps**`, inline: true },
                    { name: '💰 Cost', value: `**${cost} Caps**`, inline: false },
                    { name: '📊 New Balance', value: `**${userData.balance - cost} Caps**`, inline: false },
                    { name: 'ℹ️ How It Works', value: `If robbed, **${insuranceProtection[nextLevel]}%** of stolen caps are protected and returned to you.`, inline: false }
                )
                .setColor('#2196F3')
                .setFooter({ text: 'Insurance lasts forever! Bodyguards expire after their duration.' });

            return interaction.editReply({ embeds: [embed] });
        }
    }
}).toJSON();
