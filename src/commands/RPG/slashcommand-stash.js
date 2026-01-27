const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const db = require('../../utils/EconomyDB');

module.exports = new ApplicationCommand({
    command: {
        name: 'stash',
        description: 'Manage your hidden stash with an NPC. Grows interest but requires maintenance.',
        options: [
            {
                name: 'action',
                description: 'What action to perform',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { name: 'status', value: 'status' },
                    { name: 'deposit', value: 'deposit' },
                    { name: 'withdraw', value: 'withdraw' },
                    { name: 'pay-fee', value: 'pay-fee' },
                    { name: 'claim-interest', value: 'claim-interest' }
                ]
            },
            {
                name: 'amount',
                description: 'Amount of caps (for deposit/withdraw)',
                type: ApplicationCommandOptionType.Integer,
                required: false,
                min_value: 1,
                max_value: 999999
            }
        ]
    },
    run: async (client, interaction) => {
        const action = interaction.options.getString('action');
        const amount = interaction.options.getInteger('amount');
        const userId = interaction.user.id;

        await interaction.deferReply({ flags: 64 });

        // Get user data
        const userData = await new Promise((resolve) => {
            db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                resolve(row || { id: userId, balance: 0 });
            });
        });

        // Get stash data
        const stashData = await new Promise((resolve) => {
            db.get('SELECT * FROM stash WHERE user_id = ?', [userId], (err, row) => {
                resolve(row || { 
                    user_id: userId, 
                    amount: 0, 
                    last_fee_paid: Date.now(),
                    interest_earned: 0,
                    interest_claimed: 0
                });
            });
        });

        if (action === 'status') {
            const now = Date.now();
            const daysSinceFeePaid = Math.floor((now - stashData.last_fee_paid) / 86400000);
            const isActive = daysSinceFeePaid < 30; // Fee lasts 30 days
            
            // Calculate pending interest (0.5% daily if fee is paid)
            let pendingInterest = 0;
            if (isActive && stashData.amount > 0) {
                pendingInterest = Math.floor(stashData.amount * 0.005 * daysSinceFeePaid);
            }

            const embed = new EmbedBuilder()
                .setTitle('🏦 Your Stash Status')
                .setDescription('Managed by a shady NPC. Grows interest but requires maintenance.')
                .addFields(
                    { 
                        name: '💰 Stashed Amount', 
                        value: `**${stashData.amount} Caps**`, 
                        inline: true 
                    },
                    { 
                        name: '📈 Pending Interest', 
                        value: `**${pendingInterest} Caps** (0.5% daily)`, 
                        inline: true 
                    },
                    { 
                        name: '✅ Interest Claimed', 
                        value: `**${stashData.interest_claimed} Caps**`, 
                        inline: true 
                    },
                    { 
                        name: '🛡️ Fee Status', 
                        value: isActive 
                            ? `✅ Active (${30 - daysSinceFeePaid} days remaining)`
                            : `❌ Expired! Stash locked until you pay fee.`, 
                        inline: false 
                    },
                    { 
                        name: '📊 How It Works', 
                        value: `• **Deposit**: Pay 5% fee, store caps safely\n• **Interest**: Earn 0.5% daily if fee is paid (max 30 days)\n• **Withdraw**: Pay 2% fee to withdraw\n• **Fee**: 100 caps/month to maintain stash\n• **Risk**: Robbers can raid 10-20% of your stash if they know about it`, 
                        inline: false 
                    }
                )
                .setColor('#FFA500')
                .setFooter({ text: 'A safe hiding place... if you keep paying the NPC!' });

            return interaction.editReply({ embeds: [embed] });
        }

        if (action === 'deposit') {
            if (!amount) return interaction.editReply({ content: '❌ Please specify an amount to deposit.' });
            if (amount > userData.balance) {
                return interaction.editReply({ 
                    content: `❌ You don't have ${amount} caps. You only have ${userData.balance} caps.` 
                });
            }

            // Deposit fee is 5%
            const fee = Math.floor(amount * 0.05);
            const actualDeposit = amount - fee;

            // Deduct from balance
            await new Promise((resolve) => {
                db.run('UPDATE users SET balance = balance - ? WHERE id = ?', 
                    [amount, userId], () => resolve());
            });

            // Add to stash
            if (stashData.amount === 0) {
                // New stash - insert
                await new Promise((resolve) => {
                    db.run(
                        'INSERT INTO stash (user_id, amount, last_fee_paid, interest_earned, interest_claimed) VALUES (?, ?, ?, 0, 0)',
                        [userId, actualDeposit, Date.now()],
                        () => resolve()
                    );
                });
            } else {
                // Existing stash - update
                await new Promise((resolve) => {
                    db.run('UPDATE stash SET amount = amount + ? WHERE user_id = ?',
                        [actualDeposit, userId], () => resolve());
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Caps Deposited!')
                .setDescription('Your caps are now hidden and growing interest.')
                .addFields(
                    { name: '💰 Deposited', value: `**${actualDeposit} Caps**`, inline: true },
                    { name: '💸 NPC Fee (5%)', value: `**${fee} Caps**`, inline: true },
                    { name: '📊 New Stash Total', value: `**${stashData.amount + actualDeposit} Caps**`, inline: false },
                    { name: '📈 Earning', value: `**0.5% daily interest** if fee is maintained`, inline: false }
                )
                .setColor('#4CAF50')
                .setFooter({ text: 'Don\'t forget to pay the NPC fee monthly!' });

            return interaction.editReply({ embeds: [embed] });
        }

        if (action === 'withdraw') {
            if (!amount) return interaction.editReply({ content: '❌ Please specify an amount to withdraw.' });
            if (amount > stashData.amount) {
                return interaction.editReply({ 
                    content: `❌ You don't have ${amount} caps in your stash. You have ${stashData.amount} caps.` 
                });
            }

            // Withdraw fee is 2%
            const fee = Math.floor(amount * 0.02);
            const actualWithdraw = amount - fee;

            // Add to balance
            await new Promise((resolve) => {
                db.run('UPDATE users SET balance = balance + ? WHERE id = ?',
                    [actualWithdraw, userId], () => resolve());
            });

            // Subtract from stash
            await new Promise((resolve) => {
                db.run('UPDATE stash SET amount = amount - ? WHERE user_id = ?',
                    [amount, userId], () => resolve());
            });

            const embed = new EmbedBuilder()
                .setTitle('💵 Caps Withdrawn!')
                .setDescription('Your caps have been removed from the stash.')
                .addFields(
                    { name: '💰 Withdrawn', value: `**${actualWithdraw} Caps**`, inline: true },
                    { name: '💸 NPC Fee (2%)', value: `**${fee} Caps**`, inline: true },
                    { name: '📊 Stash Remaining', value: `**${stashData.amount - amount} Caps**`, inline: false }
                )
                .setColor('#FF9800')
                .setFooter({ text: 'Remember: Withdrawing too often reduces interest gains!' });

            return interaction.editReply({ embeds: [embed] });
        }

        if (action === 'pay-fee') {
            const feeAmount = 100;

            if (userData.balance < feeAmount) {
                return interaction.editReply({ 
                    content: `❌ You need ${feeAmount} caps to pay the NPC fee. You only have ${userData.balance} caps.` 
                });
            }

            if (stashData.amount === 0) {
                return interaction.editReply({ 
                    content: '❌ You don\'t have a stash yet. Deposit caps first using `/stash deposit`.' 
                });
            }

            // Deduct fee from balance
            await new Promise((resolve) => {
                db.run('UPDATE users SET balance = balance - ? WHERE id = ?',
                    [feeAmount, userId], () => resolve());
            });

            // Reset fee timer and grant interest bonus
            const now = Date.now();
            const daysSinceLastFee = Math.floor((now - stashData.last_fee_paid) / 86400000);
            const bonusInterest = Math.floor(stashData.amount * 0.005 * daysSinceLastFee); // 0.5% per day

            await new Promise((resolve) => {
                db.run(
                    'UPDATE stash SET last_fee_paid = ?, interest_earned = interest_earned + ? WHERE user_id = ?',
                    [now, bonusInterest, userId],
                    () => resolve()
                );
            });

            const embed = new EmbedBuilder()
                .setTitle('✅ Fee Paid!')
                .setDescription('Your stash is now secure and earning interest for another 30 days.')
                .addFields(
                    { name: '💸 Fee Amount', value: `**${feeAmount} Caps**`, inline: true },
                    { name: '📈 Interest Earned', value: `**${bonusInterest} Caps**`, inline: true },
                    { name: '⏱️ Next Fee Due', value: `In **30 days**`, inline: false },
                    { name: '💰 Stash', value: `**${stashData.amount} Caps** earning 0.5% daily`, inline: false }
                )
                .setColor('#4CAF50')
                .setFooter({ text: 'Your stash is secured for another month!' });

            return interaction.editReply({ embeds: [embed] });
        }

        if (action === 'claim-interest') {
            const now = Date.now();
            const daysSinceFeePaid = Math.floor((now - stashData.last_fee_paid) / 86400000);
            const isActive = daysSinceFeePaid < 30;

            if (!isActive) {
                return interaction.editReply({ 
                    content: '❌ Your fee has expired! Pay the NPC fee to earn more interest.' 
                });
            }

            if (stashData.amount === 0) {
                return interaction.editReply({ 
                    content: '❌ You have no stash to earn interest on!' 
                });
            }

            // Calculate interest owed
            const pendingInterest = Math.floor(stashData.amount * 0.005 * daysSinceFeePaid);

            if (pendingInterest === 0) {
                return interaction.editReply({ 
                    content: '❌ No interest earned yet. Try again after a few days!' 
                });
            }

            // Claim interest
            await new Promise((resolve) => {
                db.run(
                    'UPDATE stash SET interest_earned = 0, interest_claimed = interest_claimed + ? WHERE user_id = ?',
                    [pendingInterest, userId],
                    () => resolve()
                );
            });

            // Add interest to balance
            await new Promise((resolve) => {
                db.run('UPDATE users SET balance = balance + ? WHERE id = ?',
                    [pendingInterest, userId], () => resolve());
            });

            const embed = new EmbedBuilder()
                .setTitle('📈 Interest Claimed!')
                .setDescription('Your stash interest has been added to your balance.')
                .addFields(
                    { name: '💰 Interest Amount', value: `**${pendingInterest} Caps**`, inline: true },
                    { name: '📊 Stash Remains', value: `**${stashData.amount} Caps**`, inline: true },
                    { name: '💵 New Balance', value: `**${userData.balance + pendingInterest} Caps**`, inline: false }
                )
                .setColor('#FFD700')
                .setFooter({ text: 'Keep your stash safe and keep earning!' });

            return interaction.editReply({ embeds: [embed] });
        }
    }
}).toJSON();
