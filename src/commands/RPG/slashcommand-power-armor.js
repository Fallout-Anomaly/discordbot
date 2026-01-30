const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const db = require('../../utils/EconomyDB');

const POWER_ARMOR_SETS = {
    'vault-boy': {
        name: 'Vault Boy Suit',
        cost: 500,
        damageResist: 15,
        description: 'Classic blue and yellow vault suit',
        emoji: '🔵',
        coolness: 'Iconic'
    },
    't45': {
        name: 'T-45 Power Armor',
        cost: 2000,
        damageResist: 50,
        description: 'Prototype heavy combat armor',
        emoji: '⚙️',
        coolness: 'Military'
    },
    't51': {
        name: 'T-51 Power Armor',
        cost: 3000,
        damageResist: 60,
        description: 'Advanced combat armor',
        emoji: '🤖',
        coolness: 'Legendary'
    },
    'x01': {
        name: 'X-01 Power Armor',
        cost: 5000,
        damageResist: 75,
        description: 'Advanced prototype armor',
        emoji: '🦾',
        coolness: 'Cutting-Edge'
    },
    'brotherhood': {
        name: 'Brotherhood Power Armor',
        cost: 4000,
        damageResist: 70,
        description: 'Brotherhood of Steel elite combat suit',
        emoji: '✨',
        coolness: 'Faction'
    }
};

module.exports = new ApplicationCommand({
    command: {
        name: 'power-armor',
        description: 'Equip or view power armor for damage resistance',
        options: [
            {
                name: 'action',
                description: 'What to do',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { name: 'View My Armor', value: 'view' },
                    { name: 'Browse Armors', value: 'browse' },
                    { name: 'Equip Armor', value: 'equip' },
                    { name: 'Unequip Armor', value: 'unequip' }
                ]
            },
            {
                name: 'armor',
                description: 'Which armor to equip',
                type: ApplicationCommandOptionType.String,
                choices: Object.entries(POWER_ARMOR_SETS).map(([armorId, data]) => ({
                    name: `${data.emoji} ${data.name}`.slice(0, 100),
                    value: armorId
                })),
                required: false
            }
        ]
    },
    cooldown: 5,
    run: async (client, interaction) => {
        const userId = interaction.user.id;
        const action = interaction.options.getString('action');
        const armorKey = interaction.options.getString('armor');

        // Get user data
        const userData = await new Promise((resolve) => {
            db.get('SELECT balance, power_armor FROM users WHERE id = ?', [userId], (err, row) => {
                resolve(row || { balance: 0, power_armor: null });
            });
        });

        if (action === 'view') {
            if (!userData.power_armor) {
                const embed = new EmbedBuilder()
                    .setTitle('🔵 Power Armor Status')
                    .setDescription(`${interaction.user.username} has no power armor equipped`)
                    .addFields(
                        { name: 'Damage Resistance', value: '**0%**' },
                        { name: 'Status', value: '❌ Unequipped' }
                    )
                    .setColor('#555555')
                    .setFooter({ text: 'Use /power-armor browse to shop' });

                return interaction.reply({ embeds: [embed] });
            }

            const armor = POWER_ARMOR_SETS[userData.power_armor];
            const embed = new EmbedBuilder()
                .setTitle(`${armor.emoji} Power Armor Equipped`)
                .setDescription(armor.description)
                .addFields(
                    { name: 'Armor Type', value: `**${armor.name}**`, inline: true },
                    { name: 'Damage Resistance', value: `**${armor.damageResist}%**`, inline: true },
                    { name: 'Coolness Factor', value: armor.coolness }
                )
                .setColor('#FFD700')
                .setFooter({ text: 'War never changes, but armor does.' });

            return interaction.reply({ embeds: [embed] });
        }

        if (action === 'browse') {
            const armorList = Object.entries(POWER_ARMOR_SETS)
                .map(([_key, data]) => `${data.emoji} **${data.name}** - ${data.cost} Caps (${data.damageResist}% Resist)\n   ${data.description}`)
                .join('\n\n');

            const embed = new EmbedBuilder()
                .setTitle('🛒 Power Armor Shop')
                .setDescription('Available armor sets for purchase:\n\n' + armorList)
                .setColor('#00AA00')
                .setFooter({ text: 'Use /power-armor equip armor:[name] to purchase and equip' });

            return interaction.reply({ embeds: [embed] });
        }

        if (action === 'unequip') {
            if (!userData.power_armor) {
                return interaction.reply({ 
                    content: '❌ You are not wearing any power armor!', 
                    flags: 64 
                });
            }

            await new Promise((resolve) => {
                db.run('UPDATE users SET power_armor = NULL WHERE id = ?', [userId], () => resolve());
            });

            const armor = POWER_ARMOR_SETS[userData.power_armor];
            const embed = new EmbedBuilder()
                .setTitle(`${armor.emoji} Unequipped ${armor.name}`)
                .setDescription('Power armor removed successfully')
                .setColor('#FF6600')
                .setFooter({ text: 'Damage Resistance: 0%' });

            return interaction.reply({ embeds: [embed] });
        }

        if (action === 'equip') {
            if (!armorKey) {
                return interaction.reply({ 
                    content: '❌ Please specify which armor to equip: `/power-armor equip armor:[name]`', 
                    flags: 64 
                });
            }

            const selectedArmor = POWER_ARMOR_SETS[armorKey];
            if (!selectedArmor) {
                return interaction.reply({ 
                    content: '❌ Unknown armor type!', 
                    flags: 64 
                });
            }

            // Check if they have the armor in inventory
            const invData = await new Promise((resolve) => {
                db.get(
                    'SELECT amount FROM inventory WHERE user_id = ? AND item_id = ?',
                    [userId, armorKey],
                    (err, row) => resolve(row || { amount: 0 })
                );
            });

            if (invData.amount <= 0) {
                return interaction.reply({ 
                    content: `❌ You don't own **${selectedArmor.name}** yet!\nVisit \`/shop view armor\` to purchase one for **${selectedArmor.cost} Caps**.`, 
                    flags: 64 
                });
            }

            // Equip the armor
            await new Promise((resolve) => {
                db.run('UPDATE users SET power_armor = ? WHERE id = ?', 
                    [armorKey, userId], () => resolve());
            });

            const embed = new EmbedBuilder()
                .setTitle(`${selectedArmor.emoji} Equipped ${selectedArmor.name}!`)
                .setDescription(`You equipped advanced combat armor!`)
                .addFields(
                    { name: 'Armor', value: selectedArmor.name, inline: true },
                    { name: 'Damage Resistance', value: `+${selectedArmor.damageResist}%`, inline: true },
                    { name: 'Status', value: '✅ Equipped' }
                )
                .setColor('#FFD700')
                .setFooter({ text: 'Vault-Tec Power Armor Systems: Protecting America' });

            return interaction.reply({ embeds: [embed] });
        }
    }
}).toJSON();
