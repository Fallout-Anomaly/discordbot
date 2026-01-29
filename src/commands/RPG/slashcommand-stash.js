const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const db = require('../../utils/EconomyDB');

module.exports = new ApplicationCommand({
    command: {
        name: 'stash',
        description: 'Manage your hidden stash with an NPC. Earns daily interest with automatic fee deduction.',
        options: [
            {
                name: 'action',
                description: 'What action to perform',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { name: 'status', value: 'status' },
                    { name: 'deposit', value: 'deposit' },
                    { name: 'withdraw', value: 'withdraw' }
                ]
            },
            {
                name: 'amount',
                description: 'Amount of caps (number) or "all" (for deposit/withdraw)',
                type: ApplicationCommandOptionType.String,
                required: false,
                autocomplete: true
            }
        ]
    },
    defer: 'ephemeral',
    autocomplete: async (client, interaction) => {
        const focused = interaction.options.getFocused(true);
        if (focused.name !== 'amount') return interaction.respond([]);

        const value = String(focused.value || '').toLowerCase();
        const suggestions = [];
        if (!value || 'all'.startsWith(value)) {
            suggestions.push({ name: 'all', value: 'all' });
        }

        return interaction.respond(suggestions.slice(0, 25));
    },
    run: async (client, interaction) => {
        const action = interaction.options.getString('action');
        const amountInput = interaction.options.getString('amount');
        const normalizedAmountInput = amountInput ? amountInput.trim().toLowerCase() : null;
        const amount = normalizedAmountInput && normalizedAmountInput !== 'all'
            ? parseInt(normalizedAmountInput, 10)
            : null;
        const userId = interaction.user.id;

        // Get user data
        const userData = await new Promise((resolve) => {
            db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                if (row) {
                    resolve({
                        ...row,
                        balance: row.balance ?? 0,
                        xp: row.xp ?? 0,
                        level: row.level ?? 1
                    });
                } else {
                    resolve({ id: userId, balance: 0, xp: 0, level: 1 });
                }
            });
        });

        // Get stash data
        const stashData = await new Promise((resolve) => {
            db.get('SELECT * FROM stash WHERE user_id = ?', [userId], (err, row) => {
                if (row) {
                    resolve({
                        ...row,
                        amount: row.amount ?? 0,
                        created_at: row.created_at ?? Date.now()
                    });
                } else {
                    resolve({ 
                        user_id: userId, 
                        amount: 0, 
                        created_at: Date.now(),
                        last_fee_paid: Date.now(),
                        interest_earned: 0,
                        interest_claimed: 0
                    });
                }
            });
        });

        if (action === 'status') {
            const now = Date.now();
            const daysSinceCreated = Math.floor((now - stashData.created_at) / 86400000) || 0;
            
            // Calculate interest (0.5% daily on base amount)
            const dailyInterest = Math.floor(stashData.amount * 0.005);
            const accruedInterest = dailyInterest * Math.max(daysSinceCreated, 1);
            
            // Calculate daily fee (5 caps/day automatically)
            const dailyFee = 5;
            const totalFeeDeducted = dailyFee * Math.max(daysSinceCreated, 1);
            
            // Net gain = interest - fees
            const netGain = accruedInterest - totalFeeDeducted;
            const effectiveBalance = stashData.amount + netGain;

            const embed = new EmbedBuilder()
                .setTitle('🏦 Your Stash Status')
                .setDescription('Managed by a shady NPC. **Interest is automatic (0.5% daily). Fees are automatic (5 caps/day).**')
                .addFields(
                    { 
                        name: '💰 Base Amount', 
                        value: `**${stashData.amount} Caps**`, 
                        inline: true 
                    },
                    { 
                        name: '📈 Accrued Interest', 
                        value: `**+${accruedInterest} Caps** (0.5% daily)`, 
                        inline: true 
                    },
                    { 
                        name: '💸 Fees Deducted', 
                        value: `**-${totalFeeDeducted} Caps** (5/day)`, 
                        inline: true 
                    },
                    { 
                        name: '📊 Net Balance', 
                        value: `**${effectiveBalance} Caps** (when claimed)`, 
                        inline: false 
                    },
                    { 
                        name: '⏱️ Time Active', 
                        value: `**${daysSinceCreated} days**`, 
                        inline: false 
                    }
                )
                .setColor('#FFA500')
                .setFooter({ text: 'Use /stash deposit or /stash withdraw to add/remove caps!' });

            return interaction.editReply({ embeds: [embed] });
        }

        if (action === 'deposit') {
            const depositAmount = normalizedAmountInput === 'all' ? userData.balance : amount;
            if (!depositAmount || Number.isNaN(depositAmount) || depositAmount <= 0) {
                return interaction.editReply({ content: '❌ Please specify a valid amount to deposit.' });
            }
            if (depositAmount > userData.balance) {
                return interaction.editReply({ 
                    content: `❌ You don't have ${depositAmount} caps. You only have ${userData.balance} caps.` 
                });
            }

            // Deposit fee is 5%
            const fee = Math.floor(depositAmount * 0.05);
            const actualDeposit = depositAmount - fee;

            // Deduct from balance
            await new Promise((resolve) => {
                db.run('UPDATE users SET balance = balance - ? WHERE id = ?', 
                    [depositAmount, userId], () => resolve());
            });

            // Add to stash
            if (stashData.amount === 0) {
                // New stash - insert
                await new Promise((resolve) => {
                    db.run(
                        'INSERT INTO stash (user_id, amount, created_at) VALUES (?, ?, ?)',
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
                .setDescription('Your caps are now earning 0.5% daily interest automatically!')
                .addFields(
                    { name: '💰 Deposited', value: `**${actualDeposit} Caps**`, inline: true },
                    { name: '💸 Deposit Fee (5%)', value: `**${fee} Caps**`, inline: true },
                    { name: '📊 New Stash Total', value: `**${stashData.amount + actualDeposit} Caps**`, inline: false },
                    { name: '📈 Your Returns', value: `**0.5% daily** interest\n**-100 caps monthly** automatic fee`, inline: false }
                )
                .setColor('#4CAF50')
                .setFooter({ text: 'Interest and fees are calculated automatically!' });

            return interaction.editReply({ embeds: [embed] });
        }

        if (action === 'withdraw') {
            const withdrawAmount = normalizedAmountInput === 'all' ? stashData.amount : amount;
            if (!withdrawAmount || Number.isNaN(withdrawAmount) || withdrawAmount <= 0) {
                return interaction.editReply({ content: '❌ Please specify a valid amount to withdraw.' });
            }
            if (withdrawAmount > stashData.amount) {
                return interaction.editReply({ 
                    content: `❌ You don't have ${withdrawAmount} caps in your stash. You have ${stashData.amount} caps.` 
                });
            }

            // Calculate interest earned first
            const now = Date.now();
            const daysSinceCreated = Math.floor((now - stashData.created_at) / 86400000) || 0;
            const dailyInterest = Math.floor(stashData.amount * 0.005);
            const accruedInterest = dailyInterest * Math.max(daysSinceCreated, 1);
            const dailyFee = 5;
            const totalFeeDeducted = dailyFee * Math.max(daysSinceCreated, 1);
            const netGain = accruedInterest - totalFeeDeducted;

            // Withdraw fee is 2% on the withdrawal amount
            const withdrawFee = Math.floor(withdrawAmount * 0.02);
            const actualWithdraw = withdrawAmount - withdrawFee;
            
            // Total payout = withdrawal + net interest
            const totalPayout = actualWithdraw + netGain;

            // Add to balance (withdrawal amount + interest - fees)
            await new Promise((resolve) => {
                db.run('UPDATE users SET balance = balance + ? WHERE id = ?',
                    [totalPayout, userId], () => resolve());
            });

            // Subtract from stash
            await new Promise((resolve) => {
                db.run('UPDATE stash SET amount = amount - ? WHERE user_id = ?',
                    [withdrawAmount, userId], () => resolve());
            });

            const embed = new EmbedBuilder()
                .setTitle('💵 Caps Withdrawn!')
                .setDescription('Your withdrawal includes accrued interest minus automatic fees.')
                .addFields(
                    { name: '💰 Withdrawn', value: `**${actualWithdraw} Caps**`, inline: true },
                    { name: '📈 Interest Earned', value: `**+${netGain} Caps**`, inline: true },
                    { name: '💸 Withdraw Fee (2%)', value: `**-${withdrawFee} Caps**`, inline: true },
                    { name: '💵 Total Received', value: `**${totalPayout} Caps**`, inline: false },
                    { name: '📊 Stash Remaining', value: `**${stashData.amount - withdrawAmount} Caps**`, inline: false }
                )
                .setColor('#FF9800')
                .setFooter({ text: 'Keep stashing for long-term gains!' });

            return interaction.editReply({ embeds: [embed] });
        }
    }
}).toJSON();
