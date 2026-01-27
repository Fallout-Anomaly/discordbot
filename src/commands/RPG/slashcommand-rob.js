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

        // Get both players' data
        const robberData = await new Promise((resolve) => {
            db.get('SELECT balance FROM users WHERE id = ?', [robber.id], (err, row) => {
                resolve(row || { balance: 0 });
            });
        });

        const targetData = await new Promise((resolve) => {
            db.get('SELECT balance FROM users WHERE id = ?', [target.id], (err, row) => {
                resolve(row || { balance: 0 });
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

        const successChance = Math.max(0.1, Math.min(0.85, baseSuccessChance)); // Clamp 10%-85%
        const robSucceeds = Math.random() < successChance;

        if (robSucceeds) {
            // Calculate robbery amount: 20-40% of target's balance
            const minSteal = Math.floor(targetWealth * 0.2);
            const maxSteal = Math.floor(targetWealth * 0.4);
            const stolenAmount = Math.floor(Math.random() * (maxSteal - minSteal + 1)) + minSteal;

            // Update both players
            await new Promise((resolve) => {
                db.run('UPDATE users SET balance = balance + ? WHERE id = ?', 
                    [stolenAmount, robber.id], () => resolve());
            });

            await new Promise((resolve) => {
                db.run('UPDATE users SET balance = MAX(0, balance - ?) WHERE id = ?', 
                    [stolenAmount, target.id], () => resolve());
            });

            const embed = new EmbedBuilder()
                .setTitle('💰 ROBBERY SUCCESSFUL!')
                .setDescription(`${robber.username} successfully robbed ${target.username}!`)
                .addFields(
                    { name: '💵 Stolen Amount', value: `**${stolenAmount} Caps**`, inline: true },
                    { name: '🎯 Success Chance', value: `${(successChance * 100).toFixed(1)}%`, inline: true },
                    { name: '👤 Robber New Balance', value: `**${robberData.balance + stolenAmount} Caps**`, inline: false },
                    { name: '👤 Target New Balance', value: `**${Math.max(0, targetData.balance - stolenAmount)} Caps**`, inline: false }
                )
                .setColor('#FFD700')
                .setFooter({ text: 'Vault-Tec: "War never changes..."' });

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
                    { name: '🎯 Success Chance Was', value: `${(successChance * 100).toFixed(1)}%`, inline: true },
                    { name: '💸 Your Fine', value: `**${finAmount} Caps**`, inline: false },
                    { name: '🏆 Their Reward', value: `**${rewardAmount} Caps**`, inline: false }
                )
                .setColor('#FF4444')
                .setFooter({ text: 'Better luck next time, vault dweller!' });

            return interaction.reply({ embeds: [embed] });
        }
    }
}).toJSON();
