const { ApplicationCommandOptionType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const db = require('../../utils/EconomyDB');

module.exports = new ApplicationCommand({
    command: {
        name: 'give-caps',
        description: '[ADMIN] Give caps to a player',
        defaultMemberPermissions: PermissionFlagsBits.Administrator.toString(),
        options: [
            {
                name: 'user',
                description: 'The user to give caps to',
                type: ApplicationCommandOptionType.User,
                required: true
            },
            {
                name: 'amount',
                description: 'Amount of caps to give',
                type: ApplicationCommandOptionType.Integer,
                required: true,
                minValue: 1
            },
            {
                name: 'reason',
                description: 'Reason for giving caps (optional)',
                type: ApplicationCommandOptionType.String,
                required: false
            }
        ]
    },
    options: {
        botDevelopers: false,
        guildOwner: false
    },
    run: async (client, interaction) => {
        await interaction.deferReply({ flags: 64 });

        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const reason = interaction.options.getString('reason') || 'Admin gift';

        if (targetUser.bot) {
            return interaction.editReply({ content: '❌ You cannot give caps to bots.' });
        }

        // Get current balance
        const userData = await new Promise((resolve) => {
            db.get('SELECT balance FROM users WHERE id = ?', [targetUser.id], (err, row) => {
                resolve(row || { balance: 0 });
            });
        });

        // Add caps
        await new Promise((resolve) => {
            db.run(
                `INSERT INTO users (id, balance) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET balance = balance + ?`,
                [targetUser.id, amount, amount],
                () => resolve()
            );
        });

        const newBalance = (userData.balance ?? 0) + amount;

        const embed = new EmbedBuilder()
            .setTitle('💰 Caps Given')
            .setDescription(`Successfully gave **${amount} caps** to <@${targetUser.id}>`)
            .addFields(
                { name: '👤 Recipient', value: `<@${targetUser.id}>`, inline: true },
                { name: '💵 Amount', value: `${amount} caps`, inline: true },
                { name: '📊 New Balance', value: `${newBalance} caps`, inline: true },
                { name: '📝 Reason', value: reason, inline: false },
                { name: '👮 Admin', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setColor('#2ecc71')
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    }
}).toJSON();
