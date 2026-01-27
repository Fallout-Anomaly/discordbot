const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const db = require('../../utils/EconomyDB');

const BEVERAGES = {
    'nuka-cola': {
        name: 'Nuka-Cola',
        cost: 25,
        health: 25,
        description: 'Refreshing caffeine-loaded cola',
        emoji: '🥤',
        effect: 'Restores 25 Health'
    },
    'nuka-quantum': {
        name: 'Nuka-Cola Quantum',
        cost: 75,
        health: 50,
        radiation: -10,
        description: 'Glowing blue essence of happiness',
        emoji: '💧',
        effect: 'Restores 50 Health, -10% Radiation'
    },
    'whiskey': {
        name: 'Whiskey',
        cost: 40,
        health: 15,
        charisma: 1,
        description: 'Smooth bourbon for the wasteland',
        emoji: '🥃',
        effect: '+1 Charisma for 1 hour'
    },
    'mentats': {
        name: 'Mentats',
        cost: 60,
        intelligence: 2,
        description: 'Smarts in a bottle',
        emoji: '🧠',
        effect: '+2 Intelligence for 1 hour'
    },
    'radroach-meat': {
        name: 'Radroach Meat',
        cost: 10,
        health: 10,
        description: 'Not the most appetizing, but it works',
        emoji: '🪳',
        effect: 'Restores 10 Health'
    },
    'brahmin-steak': {
        name: 'Brahmin Steak',
        cost: 50,
        health: 40,
        description: 'Delicious mutant cow',
        emoji: '🥩',
        effect: 'Restores 40 Health'
    }
};

module.exports = new ApplicationCommand({
    command: {
        name: 'nuka-cola',
        description: 'Consume wasteland beverages and food for buffs',
        options: [
            {
                name: 'item',
                description: 'What to consume',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: Object.entries(BEVERAGES).map(([key, data]) => ({
                    name: `${data.emoji} ${data.name} - ${data.cost} Caps`,
                    value: key
                }))
            }
        ]
    },
    cooldown: 10,
    run: async (client, interaction) => {
        const userId = interaction.user.id;
        const itemKey = interaction.options.getString('item');
        const beverage = BEVERAGES[itemKey];

        if (!beverage) {
            return interaction.reply({ 
                content: '❌ Unknown item!', 
                flags: 64 
            });
        }

        // Check if player has the item in inventory
        const invData = await new Promise((resolve) => {
            db.get(
                'SELECT amount FROM inventory WHERE user_id = ? AND item_id = ?',
                [userId, itemKey],
                (err, row) => resolve(row || { amount: 0 })
            );
        });

        if (invData.amount <= 0) {
            return interaction.reply({ 
                content: `❌ You don't have **${beverage.name}** in your inventory!\nVisit \`/shop view consumable\` to purchase one.`, 
                flags: 64 
            });
        }

        // Deduct cost
        const newBalance = userData.balance - beverage.cost;

        // Apply effects
        const currentHealth = userData.health || 100;
        let newHealth = Math.min(100, currentHealth + (beverage.health || 0));
        let radiationReduction = beverage.radiation || 0;

        // Update database
        let updateQuery = 'UPDATE users SET ';
        let params = [];

        if (beverage.health) {
            updateQuery += 'health = ?, ';
            params.push(newHealth);
        }

        if (radiationReduction !== 0) {
            updateQuery += 'radiation = MAX(0, radiation + ?), ';
            params.push(radiationReduction);
        }

        updateQuery += 'balance = ? WHERE id = ?';
        params.push(-beverage.cost);
        params.push(userId);

        // Remove 1 item from inventory and deduct caps
        await new Promise((resolve) => {
            db.serialize(() => {
                // Deduct caps
                db.run('UPDATE users SET balance = balance ? WHERE id = ?', params.slice(-2), () => {});
                
                // Remove item from inventory
                db.run(
                    'UPDATE inventory SET amuserData.health} → ${Math.min(100, userData.health + beverage.health)_id = ? AND item_id = ? AND amount > 0',
                    [userId, itemKey],
                    () => resolve()
                );
            });
        });

        // Get user's current health and radiation for display
        const userData = await new Promise((resolve) => {
            db.get('SELECT health, radiation FROM users WHERE id = ?', [userId], (err, row) => {
                resolve(row || { health: 100, radiation: 0 });
            });
        });

        // Build effect text
        let effectText = beverage.effect;
        let extraEffects = [];

        if (beverage.health) {
            extraEffects.push(`❤️ Health: ${currentHealth} → ${newHealth}`);
        }
        if (radiationReduction < 0) {
            extraEffects.push(`☢️ Radiation reduced by ${Math.abs(radiationReduction)}%`);
        }
        if (beverage.charisma) {
            extraEffects.push(`💬 Charisma +${beverage.charisma} for 1 hour`);
        }
        if (beverage.intelligence) {
            extraEffects.push(`🧠 Intelligence +${beverage.intelligence} for 1 hour`);
        }

        const embed = new EmbedBuilder()
            .setTitle(`${beverage.emoji} Consumed ${beverage.name}`)
            .setDescription(beverage.description)
            .addFields(
                { name: 'Effect', value: effectText, inline: false },
                { name: 'Remaining Items', value: `**${Math.max(0, invData.amount - 1)}x** left in inventory`, inline: true }
            )
            .setColor('#FF6B00')
            .setFooter({ text: 'Vault-Tec: Enhancing Life in the Wasteland!' });

        if (extraEffects.length > 0) {
            embed.addFields({ name: 'Changes', value: extraEffects.join('\n') });
        }

        return interaction.reply({ embeds: [embed] });
    }
}).toJSON();
