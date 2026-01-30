const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const db = require('../../utils/EconomyDB');
const { ROBBERY_MODIFIERS } = require('../../utils/Constants');
const { error } = require('../../utils/Console');

module.exports = new ApplicationCommand({
    command: {
        name: 'rob',
        description: 'Attempt to rob another player for their caps. High risk, high reward.',
        options: [
            {
                name: 'target',
                description: 'The player to rob',
                type: ApplicationCommandOptionType.User,
                required: true
            }
        ]
    },
    run: async (client, interaction) => {
        await interaction.deferReply();
        const target = interaction.options.getUser('target');
        const robber = interaction.user;
        const now = Date.now();
        const ROB_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

        // Check cooldown
        const hasCooldown = await new Promise((resolve) => {
            db.get('SELECT cooldown_expiry FROM rob_cooldown WHERE user_id = ?', [robber.id], (err, row) => {
                if (row && now < row.cooldown_expiry) {
                    const remaining = row.cooldown_expiry - now;
                    const minutes = Math.ceil(remaining / 60000);
                    interaction.editReply({ 
                        content: `⏳ You need to lay low after that robbery. Wait **${minutes} minute${minutes > 1 ? 's' : ''}** before robbing again.` 
                    });
                    return resolve(true);
                }
                resolve(false);
            });
        });

        if (hasCooldown) return;

        // Prevent self-robbery
        if (target.id === robber.id) {
            return interaction.editReply({ 
                content: '❌ You cannot rob yourself, vault dweller!' 
            });
        }

        // Prevent bot robbery
        if (target.bot) {
            return interaction.editReply({ 
                content: '❌ You cannot rob a bot!' 
            });
        }

        // Get both players' data including protection
        const robberData = await new Promise((resolve, reject) => {
            db.get('SELECT balance, stat_strength, stat_agility FROM users WHERE id = ?', [robber.id], (err, row) => {
                if (err) reject(err);
                resolve(row || { balance: 0, stat_strength: 1, stat_agility: 1 });
            });
        }).catch(err => {
            error('[ROB] DB Error fetching robber:', err);
            return null;
        });

        if (!robberData) return interaction.editReply({ content: '❌ Database error fetching your data.' });

        const targetData = await new Promise((resolve, reject) => {
            db.get('SELECT balance, stat_strength, stat_agility, protection_expires, insurance_level FROM users WHERE id = ?', [target.id], (err, row) => {
                if (err) reject(err);
                resolve(row || { balance: 0, stat_strength: 1, stat_agility: 1, protection_expires: 0, insurance_level: 0 });
            });
        }).catch(err => {
            error('[ROB] DB Error fetching target:', err);
            return null;
        });

        if (!targetData) return interaction.editReply({ content: '❌ Database error fetching target data.' });

        // Get target's stash (if any)
        const targetStash = await new Promise((resolve, reject) => {
            db.get('SELECT amount FROM stash WHERE user_id = ?', [target.id], (err, row) => {
                if (err) reject(err);
                resolve(row || { amount: 0 });
            });
        }).catch(() => ({ amount: 0 }));

        // Check if target has caps to rob
        if (targetData.balance < ROBBERY_MODIFIERS.MIN_BALANCE_REQUIRED) {
            return interaction.editReply({ 
                content: `😂 **${target.username}** doesn't have enough caps to rob (needs at least ${ROBBERY_MODIFIERS.MIN_BALANCE_REQUIRED}). Try someone wealthier!` 
            });
        }

        // Success chance depends on balance difference and random luck
        const robberWealth = robberData.balance;
        const targetWealth = targetData.balance;
        
        // Check if target has active bodyguard protection
        const hasBodyguards = targetData.protection_expires && targetData.protection_expires > now;
        
        let baseSuccessChance = ROBBERY_MODIFIERS.BASE_SUCCESS_CHANCE;
        
        // Wealth modifier
        if (robberWealth < targetWealth / 2) {
            baseSuccessChance += ROBBERY_MODIFIERS.POVERTY_BONUS;
        }
        
        if (robberWealth > targetWealth * 2) {
            baseSuccessChance -= ROBBERY_MODIFIERS.WEALTH_PENALTY;
        }

        // Bodyguard penalty
        if (hasBodyguards) {
            baseSuccessChance -= ROBBERY_MODIFIERS.BODYGUARD_PENALTY;
        }

        const successChance = Math.max(ROBBERY_MODIFIERS.MIN_SUCCESS, Math.min(ROBBERY_MODIFIERS.MAX_SUCCESS, baseSuccessChance));
        const robSucceeds = Math.random() < successChance;

        if (robSucceeds) {
            // Calculate robbery amount: 20-40% of target's balance
            const minSteal = Math.floor(targetWealth * 0.2);
            const maxSteal = Math.floor(targetWealth * 0.4);
            let stolenAmount = Math.floor(Math.random() * (maxSteal - minSteal + 1)) + minSteal;

            // Apply insurance protection: returns a % of stolen caps to target
            const insuranceLevel = targetData.insurance_level || 0;
            const insuranceProtection = [0, 10, 25, 40]; // % returned
            const insuranceRefund = Math.floor(stolenAmount * (insuranceProtection[insuranceLevel] / 100));
            
            const actualLost = stolenAmount - insuranceRefund;

            // Attempt to raid stash (30% chance if stash exists)
            let stashRaidAmount = 0;
            let stashWasRaided = false;
            if (targetStash.amount > 0 && Math.random() < 0.3) {
                // Steal 10-20% of stash
                stashWasRaided = true;
                const minStashRaid = Math.floor(targetStash.amount * 0.1);
                const maxStashRaid = Math.floor(targetStash.amount * 0.2);
                stashRaidAmount = Math.floor(Math.random() * (maxStashRaid - minStashRaid + 1)) + minStashRaid;
            }
            const totalStealing = stolenAmount + stashRaidAmount;

            // Perform Transaction
            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');

                    if (stashWasRaided) {
                        db.run('UPDATE stash SET amount = amount - ? WHERE user_id = ?', [stashRaidAmount, target.id]);
                    }

                    db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [totalStealing, robber.id]);
                    db.run('UPDATE users SET balance = MAX(0, balance - ?) WHERE id = ?', [actualLost, target.id]);

                    db.run('COMMIT', (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            }).catch(err => {
                error('[ROB] Transaction failed:', err);
                return interaction.editReply({ content: '❌ Transaction failed during robbery.' });
            });

            // Set robbery cooldown
            const cooldownEnd = now + ROB_COOLDOWN;
            await new Promise((resolve) => {
                db.run('INSERT OR REPLACE INTO rob_cooldown (user_id, cooldown_expiry) VALUES (?, ?)', [robber.id, cooldownEnd], () => resolve());
            });

            const embed = new EmbedBuilder()
                .setTitle('💰 ROBBERY SUCCESSFUL!')
                .setDescription(`${robber.username} successfully robbed ${target.username}!`)
                .addFields(
                    { name: '💵 Main Balance Stolen', value: `**${stolenAmount} Caps**`, inline: true },
                    { name: '🎯 Success Chance', value: `${(successChance * 100).toFixed(1)}%`, inline: true }
                );

            if (insuranceRefund > 0) {
                embed.addFields({ name: '🛡️ Insurance Refund', value: `**${insuranceRefund} Caps** returned`, inline: true });
            }

            if (stashWasRaided) {
                embed.addFields({ name: '💼 Stash Raided!', value: `**${stashRaidAmount} Caps** from hidden stash stolen`, inline: true });
            }

            if (hasBodyguards) {
                const protectionRemaining = Math.ceil((targetData.protection_expires - now) / 3600000);
                embed.addFields({ name: '💂 Bodyguards', value: `Present but couldn't stop this robbery (${protectionRemaining}h left)`, inline: true });
            }

            embed.addFields(
                { name: '👤 Robber New Balance', value: `**${robberData.balance + totalStealing} Caps**`, inline: false },
                { name: '👤 Target New Balance', value: `**${Math.max(0, targetWealth - actualLost)} Caps**`, inline: false }
            )
            .setColor('#FFD700')
            .setFooter({ text: 'Tip: Use /protection & /stash to defend your wealth!' });

            return interaction.editReply({ embeds: [embed] });
        } else {
            // Failed robbery - lose a small amount as fine
            const fineAmount = Math.floor(targetWealth * 0.05); // 5% fine
            const rewardToTarget = Math.floor(fineAmount * ROBBERY_MODIFIERS.VICTIM_REWARD_PERCENT); // % of fine
            
            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');
                    
                    db.run('UPDATE users SET balance = MAX(0, balance - ?) WHERE id = ?', [fineAmount, robber.id]);
                    db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [rewardToTarget, target.id]);

                    db.run('COMMIT', (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            }).catch(err => {
                error('[ROB] Fail transaction failed:', err);
                return interaction.editReply({ content: '❌ Database error during failed robbery processing.' });
            });

            // Set robbery cooldown even on failure
            const cooldownEnd = now + ROB_COOLDOWN;
            await new Promise((resolve) => {
                db.run('INSERT OR REPLACE INTO rob_cooldown (user_id, cooldown_expiry) VALUES (?, ?)', [robber.id, cooldownEnd], () => resolve());
            });

            const embed = new EmbedBuilder()
                .setTitle('🚨 ROBBERY FAILED!')
                .setDescription(`${robber.username} was caught by ${target.username}!`)
                .addFields(
                    { name: '❌ You Got Caught!', value: `Paid **${fineAmount} Caps** fine`, inline: true },
                    { name: '🎯 Success Chance Was', value: `${(successChance * 100).toFixed(1)}%`, inline: true }
                );

            if (hasBodyguards) {
                embed.addFields({ name: '💂 Bodyguards', value: `**Stopped the robbery!** Provided -30% success bonus`, inline: true });
            }

            embed.addFields(
                { name: '💸 Your Fine', value: `**${fineAmount} Caps**`, inline: false },
                { name: '🏆 Their Reward', value: `**${rewardToTarget} Caps**`, inline: false }
            )
            .setColor('#FF4444')
            .setFooter({ text: 'Better luck next time, vault dweller!' });

            return interaction.editReply({ embeds: [embed] });
        }
    }
}).toJSON();
