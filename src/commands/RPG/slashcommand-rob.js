const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const db = require('../../utils/EconomyDB');

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
    cooldown: 30,
    run: async (client, interaction) => {
        const target = interaction.options.getUser('target');
        const robber = interaction.user;

        // Prevent self-robbery
        if (target.id === robber.id) {
            return interaction.reply({ 
                content: '❌ You cannot rob yourself, vault dweller!', 
                flags: 64 
            });
        }

        // Prevent bot robbery
        if (target.bot) {
            return interaction.reply({ 
                content: '❌ You cannot rob a bot!', 
                flags: 64 
            });
        }

        // Get both players' data including protection
        const robberData = await new Promise((resolve) => {
            db.get('SELECT balance, stat_strength, stat_agility FROM users WHERE id = ?', [robber.id], (err, row) => {
                resolve(row || { balance: 0, stat_strength: 1, stat_agility: 1 });
            });
        });

        const targetData = await new Promise((resolve) => {
            db.get('SELECT balance, stat_strength, stat_agility, protection_expires, insurance_level FROM users WHERE id = ?', [target.id], (err, row) => {
                resolve(row || { balance: 0, stat_strength: 1, stat_agility: 1, protection_expires: 0, insurance_level: 0 });
            });
        });

        // Get target's stash (if any)
        const targetStash = await new Promise((resolve) => {
            db.get('SELECT amount FROM stash WHERE user_id = ?', [target.id], (err, row) => {
                resolve(row || { amount: 0 });
            });
        });

        // Check if target has caps to rob
        if (targetData.balance < 100) {
            return interaction.reply({ 
                content: `😂 **${target.username}** doesn't have enough caps to rob (needs at least 100). Try someone wealthier!`, 
                flags: 64 
            });
        }

        // Success chance depends on balance difference and random luck
        const robberWealth = robberData.balance;
        const targetWealth = targetData.balance;
        
        // Check if target has active bodyguard protection
        const now = Date.now();
        const hasBodyguards = targetData.protection_expires && targetData.protection_expires > now;
        
        // Lower balance = better chance to rob (desperate times)
        // Higher balance = lower chance (can afford protection)
        let baseSuccessChance = 0.45; // 45% base success
        
        // Wealth modifier: if robber is poorer, they have better odds
        if (robberWealth < targetWealth / 2) {
            baseSuccessChance += 0.15; // +15% if significantly poorer
        }
        
        // If robber is much wealthier, lower success (risky move)
        if (robberWealth > targetWealth * 2) {
            baseSuccessChance -= 0.10; // -10% if much wealthier
        }

        // Bodyguard penalty: -30% success chance
        if (hasBodyguards) {
            baseSuccessChance -= 0.30;
        }

        const successChance = Math.max(0.1, Math.min(0.85, baseSuccessChance)); // Clamp 10%-85%
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

                // Update stash
                await new Promise((resolve) => {
                    db.run('UPDATE stash SET amount = amount - ? WHERE user_id = ?',
                        [stashRaidAmount, target.id], () => resolve());
                });
            }

            const totalStealing = stolenAmount + stashRaidAmount;

            // Update both players
            await new Promise((resolve) => {
                db.run('UPDATE users SET balance = balance + ? WHERE id = ?', 
                    [totalStealing, robber.id], () => resolve());
            });

            await new Promise((resolve) => {
                db.run('UPDATE users SET balance = MAX(0, balance - ?) WHERE id = ?', 
                    [actualLost, target.id], () => resolve());
            });

            const embed = new EmbedBuilder()
                .setTitle('💰 ROBBERY SUCCESSFUL!')
                .setDescription(`${robber.username} successfully robbed ${target.username}!`)
                .addFields(
                    { name: '💵 Main Balance Stolen', value: `**${stolenAmount} Caps**`, inline: true },
                    { name: '🎯 Success Chance', value: `${(successChance * 100).toFixed(1)}%`, inline: true }
                );

            // Add insurance refund field if applicable
            // Add insurance refund field if applicable
            if (insuranceRefund > 0) {
                embed.addFields({ name: '🛡️ Insurance Refund', value: `**${insuranceRefund} Caps** returned`, inline: true });
            }

            // Add stash raid if it happened
            if (stashWasRaided) {
                embed.addFields({ name: '💼 Stash Raided!', value: `**${stashRaidAmount} Caps** from hidden stash stolen`, inline: true });
            }

            // Add bodyguard mention if they were active
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

            return interaction.reply({ embeds: [embed] });
        } else {
            // Failed robbery - lose a small amount as fine
            const finAmount = Math.floor(targetWealth * 0.05); // 5% fine
            
            await new Promise((resolve) => {
                db.run('UPDATE users SET balance = MAX(0, balance - ?) WHERE id = ?', 
                    [finAmount, robber.id], () => resolve());
            });

            // Target gains a small reward for catching the robber
            const rewardAmount = Math.floor(finAmount * 0.5);
            await new Promise((resolve) => {
                db.run('UPDATE users SET balance = balance + ? WHERE id = ?', 
                    [rewardAmount, target.id], () => resolve());
            });

            const embed = new EmbedBuilder()
                .setTitle('🚨 ROBBERY FAILED!')
                .setDescription(`${robber.username} was caught by ${target.username}!`)
                .addFields(
                    { name: '❌ You Got Caught!', value: `Paid **${finAmount} Caps** fine`, inline: true },
                    { name: '🎯 Success Chance Was', value: `${(successChance * 100).toFixed(1)}%`, inline: true }
                );

            // Show why it failed
            if (hasBodyguards) {
                embed.addFields({ name: '💂 Bodyguards', value: `**Stopped the robbery!** Provided -30% success bonus`, inline: true });
            }

            embed.addFields(
                { name: '💸 Your Fine', value: `**${finAmount} Caps**`, inline: false },
                { name: '🏆 Their Reward', value: `**${rewardAmount} Caps**`, inline: false }
            )
            .setColor('#FF4444')
            .setFooter({ text: 'Better luck next time, vault dweller!' });

            return interaction.reply({ embeds: [embed] });
        }
    }
}).toJSON();
