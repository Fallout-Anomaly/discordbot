const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const fs = require('fs');
const path = require('path');

const TRIGGERS_FILE = path.resolve(__dirname, '../../data/autoTriggers.json');

function loadTriggers() {
    try {
        return JSON.parse(fs.readFileSync(TRIGGERS_FILE, 'utf8'));
    } catch {
        return [];
    }
}

function saveTriggers(triggers) {
    fs.writeFileSync(TRIGGERS_FILE, JSON.stringify(triggers, null, 4), 'utf8');
}

module.exports = new ApplicationCommand({
    command: new SlashCommandBuilder()
        .setName('autotrigger')
        .setDescription('Manage auto-response triggers')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub => sub
            .setName('add')
            .setDescription('Add a new auto-response trigger')
            .addStringOption(opt => opt
                .setName('keywords')
                .setDescription('Keywords separated by commas (e.g. "crash,ctd,startup")')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('response')
                .setDescription('Response message to send')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('Remove an auto-response trigger by index')
            .addNumberOption(opt => opt
                .setName('index')
                .setDescription('Trigger index from /autotrigger list')
                .setRequired(true)
                .setMinValue(0)))
        .addSubcommand(sub => sub
            .setName('edit')
            .setDescription('Edit an existing trigger')
            .addNumberOption(opt => opt
                .setName('index')
                .setDescription('Trigger index from /autotrigger list')
                .setRequired(true)
                .setMinValue(0))
            .addStringOption(opt => opt
                .setName('keywords')
                .setDescription('New keywords (comma separated)')
                .setRequired(false))
            .addStringOption(opt => opt
                .setName('response')
                .setDescription('New response message')
                .setRequired(false)))
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('List all auto-response triggers'))
        .addSubcommand(sub => sub
            .setName('clear')
            .setDescription('Clear all auto-response triggers')),
    options: {
        cooldown: 3000,
        isOwnerOnly: false,
        isDeveloperOnly: false,
        isNSFW: false,
        defer: { flags: 64 }
    },
    run: async (client, interaction) => {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'add') {
            const keywordsInput = interaction.options.getString('keywords');
            const response = interaction.options.getString('response');

            const keywords = keywordsInput.split(',').map(k => k.trim()).filter(k => k.length > 0);

            if (keywords.length === 0) {
                return interaction.editReply({
                    content: '❌ You must provide at least one keyword.',
                    flags: 64
                });
            }

            const triggers = loadTriggers();
            triggers.push({ keywords, response });
            saveTriggers(triggers);

            const embed = new EmbedBuilder()
                .setTitle('✅ Auto-Trigger Added')
                .setColor('#00ff00')
                .addFields(
                    { name: 'Keywords', value: keywords.join(', '), inline: false },
                    { name: 'Response', value: response.length > 1024 ? response.substring(0, 1020) + '...' : response, inline: false },
                    { name: 'Index', value: `${triggers.length - 1}`, inline: true }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'remove') {
            const index = interaction.options.getNumber('index');
            const triggers = loadTriggers();

            if (index < 0 || index >= triggers.length) {
                return interaction.editReply({
                    content: `❌ Invalid index. Use \`/autotrigger list\` to see available triggers (0-${triggers.length - 1}).`,
                    flags: 64
                });
            }

            const removed = triggers.splice(index, 1)[0];
            saveTriggers(triggers);

            const embed = new EmbedBuilder()
                .setTitle('✅ Auto-Trigger Removed')
                .setColor('#ff6600')
                .addFields(
                    { name: 'Keywords', value: removed.keywords.join(', '), inline: false },
                    { name: 'Response', value: removed.response.length > 1024 ? removed.response.substring(0, 1020) + '...' : removed.response, inline: false }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'edit') {
            const index = interaction.options.getNumber('index');
            const keywordsInput = interaction.options.getString('keywords');
            const response = interaction.options.getString('response');

            const triggers = loadTriggers();

            if (index < 0 || index >= triggers.length) {
                return interaction.editReply({
                    content: `❌ Invalid index. Use \`/autotrigger list\` to see available triggers (0-${triggers.length - 1}).`,
                    flags: 64
                });
            }

            if (keywordsInput) {
                const keywords = keywordsInput.split(',').map(k => k.trim()).filter(k => k.length > 0);
                if (keywords.length > 0) {
                    triggers[index].keywords = keywords;
                }
            }

            if (response) {
                triggers[index].response = response;
            }

            saveTriggers(triggers);

            const embed = new EmbedBuilder()
                .setTitle('✅ Auto-Trigger Updated')
                .setColor('#0099ff')
                .addFields(
                    { name: 'Index', value: `${index}`, inline: true },
                    { name: 'Keywords', value: triggers[index].keywords.join(', '), inline: false },
                    { name: 'Response', value: triggers[index].response.length > 1024 ? triggers[index].response.substring(0, 1020) + '...' : triggers[index].response, inline: false }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'list') {
            const triggers = loadTriggers();

            if (triggers.length === 0) {
                return interaction.editReply({
                    content: '📭 No auto-response triggers configured.',
                    flags: 64
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('⚡ Auto-Response Triggers')
                .setColor('#0099ff')
                .setDescription(`Total: ${triggers.length} triggers`)
                .setTimestamp();

            triggers.forEach((trigger, index) => {
                const keywords = trigger.keywords.join(', ');
                const response = trigger.response.length > 200 ? trigger.response.substring(0, 197) + '...' : trigger.response;
                
                embed.addFields({
                    name: `[${index}] ${keywords}`,
                    value: response,
                    inline: false
                });
            });

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'clear') {
            const triggers = loadTriggers();
            const count = triggers.length;

            saveTriggers([]);

            const embed = new EmbedBuilder()
                .setTitle('🗑️ All Auto-Triggers Cleared')
                .setColor('#ff0000')
                .setDescription(`Removed ${count} trigger(s).`)
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }
    }
}).toJSON();
