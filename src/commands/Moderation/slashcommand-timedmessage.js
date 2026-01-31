const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const fs = require('fs');
const path = require('path');

const TIMED_MESSAGES_FILE = path.resolve(__dirname, '../../data/timedMessages.json');

// Ensure file exists
if (!fs.existsSync(TIMED_MESSAGES_FILE)) {
    fs.writeFileSync(TIMED_MESSAGES_FILE, JSON.stringify([], null, 2), 'utf8');
}

function loadTimedMessages() {
    try {
        return JSON.parse(fs.readFileSync(TIMED_MESSAGES_FILE, 'utf8'));
    } catch {
        return [];
    }
}

function saveTimedMessages(messages) {
    fs.writeFileSync(TIMED_MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf8');
}

function generateId() {
    return `tm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = new ApplicationCommand({
    command: new SlashCommandBuilder()
        .setName('timedmessage')
        .setDescription('Setup timed recurring messages')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub => sub
            .setName('add')
            .setDescription('Add a new timed message')
            .addChannelOption(opt => opt
                .setName('channel')
                .setDescription('Channel to send message in')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('message')
                .setDescription('Message content (supports embeds with {})')
                .setRequired(true)
                .setMaxLength(2000))
            .addNumberOption(opt => opt
                .setName('interval')
                .setDescription('Interval in minutes (1-10080)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10080)))
        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('Remove a timed message')
            .addStringOption(opt => opt
                .setName('id')
                .setDescription('Message ID (get from /timedmessage list)')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('List all timed messages')),
    options: {
        cooldown: 5000,
        isOwnerOnly: false,
        isDeveloperOnly: false,
        isNSFW: false,
        defer: { flags: 64 }
    },
    run: async (client, interaction) => {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'add') {
            const channel = interaction.options.getChannel('channel');
            const message = interaction.options.getString('message');
            const interval = interaction.options.getNumber('interval');

            const messages = loadTimedMessages();
            const id = generateId();

            const newMessage = {
                id,
                guild_id: interaction.guild.id,
                channel_id: channel.id,
                message_content: message,
                interval_minutes: interval,
                created_by: interaction.user.id,
                created_at: Date.now(),
                last_sent: null,
                enabled: true
            };

            messages.push(newMessage);
            saveTimedMessages(messages);

            const embed = new EmbedBuilder()
                .setTitle('✅ Timed Message Added')
                .setColor('#00ff00')
                .addFields(
                    { name: 'ID', value: `\`${id}\``, inline: false },
                    { name: 'Channel', value: channel.toString(), inline: true },
                    { name: 'Interval', value: `${interval} minutes`, inline: true },
                    { name: 'First Message', value: 'Will send within 1 minute', inline: false }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'remove') {
            const id = interaction.options.getString('id');
            let messages = loadTimedMessages();
            const originalLength = messages.length;

            messages = messages.filter(m => m.id !== id && m.guild_id === interaction.guild.id);

            if (messages.length === originalLength) {
                return interaction.editReply({
                    content: '❌ Timed message not found.',
                    flags: 64
                });
            }

            saveTimedMessages(messages);

            const embed = new EmbedBuilder()
                .setTitle('✅ Timed Message Removed')
                .setColor('#ff6600')
                .setDescription(`Message ID \`${id}\` has been removed.`)
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'list') {
            const messages = loadTimedMessages().filter(m => m.guild_id === interaction.guild.id);

            if (messages.length === 0) {
                return interaction.editReply({
                    content: '📭 No timed messages set up in this server.',
                    flags: 64
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('⏰ Timed Messages')
                .setColor('#0099ff')
                .setDescription(`Total: ${messages.length}`)
                .setTimestamp();

            messages.forEach(msg => {
                const channel = `<#${msg.channel_id}>`;
                const lastSent = msg.last_sent ? `<t:${Math.floor(msg.last_sent / 1000)}:R>` : 'Never';
                embed.addFields({
                    name: `${msg.enabled ? '✅' : '❌'} ${msg.id}`,
                    value: `Channel: ${channel}\nInterval: ${msg.interval_minutes}m\nLast Sent: ${lastSent}`,
                    inline: false
                });
            });

            return interaction.editReply({ embeds: [embed] });
        }
    }
}).toJSON();
