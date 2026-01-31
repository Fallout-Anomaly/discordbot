const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const config = require('../../config');
const fs = require('fs');
const path = require('path');

module.exports = new ApplicationCommand({
    command: new SlashCommandBuilder()
        .setName('scam-guard')
        .setDescription('Configure scam protection settings for images/attachments')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub => sub
            .setName('view')
            .setDescription('View current scam guard settings'))
        .addSubcommand(sub => sub
            .setName('set-join-age')
            .setDescription('Set minimum server join age to post images (in days)')
            .addNumberOption(opt => opt
                .setName('days')
                .setDescription('Days required (0 = disabled, max 365)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(365)))
        .addSubcommand(sub => sub
            .setName('set-account-age')
            .setDescription('Set minimum Discord account age to post images (in days)')
            .addNumberOption(opt => opt
                .setName('days')
                .setDescription('Days required (0 = disabled, max 365)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(365)))
        .addSubcommand(sub => sub
            .setName('toggle')
            .setDescription('Enable or disable scam guard')
            .addBooleanOption(opt => opt
                .setName('enabled')
                .setDescription('Enable scam guard?')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('set-channels')
            .setDescription('Set channels to monitor (leave empty to monitor all)')
            .addStringOption(opt => opt
                .setName('channels')
                .setDescription('Channel IDs separated by commas, or "all" for all channels')
                .setRequired(true))),
    options: {
        cooldown: 5000,
        isOwnerOnly: false,
        isDeveloperOnly: false,
        isNSFW: false,
        defer: { flags: 64 }
    },
    run: async (client, interaction) => {
        const subcommand = interaction.options.getSubcommand();
        const guardConfig = config.moderation.scam_guard;

        if (subcommand === 'view') {
            const monitorText = guardConfig.monitorChannels.length === 0 
                ? 'All channels' 
                : guardConfig.monitorChannels.map(id => `<#${id}>`).join(', ');
            
            const ignoreText = guardConfig.ignoreChannels.length === 0 
                ? 'None' 
                : guardConfig.ignoreChannels.map(id => `<#${id}>`).join(', ');

            const embed = new EmbedBuilder()
                .setTitle('🛡️ Scam Guard Configuration')
                .setColor(guardConfig.enabled ? '#00ff00' : '#ff0000')
                .addFields(
                    { name: 'Status', value: guardConfig.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: 'Delete Attachments', value: guardConfig.deleteAttachments ? '✅ Yes' : '❌ No', inline: true },
                    { name: 'Block New Account Images', value: guardConfig.blockNewAccountAttachments ? '✅ Yes' : '❌ No', inline: true },
                    { name: 'Min Join Age', value: `${guardConfig.minJoinAgeDays} days`, inline: true },
                    { name: 'Min Account Age', value: `${guardConfig.minAccountAgeDays} days`, inline: true },
                    { name: 'Notify User', value: guardConfig.notifyUser ? '✅ Yes' : '❌ No', inline: true },
                    { name: 'Monitor Channels', value: monitorText, inline: false },
                    { name: 'Ignore Channels', value: ignoreText, inline: false }
                )
                .setFooter({ text: 'Use /scam-guard set-join-age to change join requirements' })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'set-join-age') {
            const days = interaction.options.getNumber('days');
            
            // Update in-memory config
            config.moderation.scam_guard.minJoinAgeDays = days;

            // Update config.js file
            const configPath = path.resolve(__dirname, '../../config.js');
            let configContent = fs.readFileSync(configPath, 'utf8');
            
            // Replace the minJoinAgeDays value
            configContent = configContent.replace(
                /minJoinAgeDays:\s*\d+/,
                `minJoinAgeDays: ${days}`
            );
            
            fs.writeFileSync(configPath, configContent, 'utf8');

            const embed = new EmbedBuilder()
                .setTitle('✅ Join Age Requirement Updated')
                .setDescription(days === 0 
                    ? 'New members can now post images immediately.' 
                    : `Users must be in the server for **${days} days** before posting images/attachments.`)
                .setColor('#00ff00')
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'set-account-age') {
            const days = interaction.options.getNumber('days');
            
            config.moderation.scam_guard.minAccountAgeDays = days;

            const configPath = path.resolve(__dirname, '../../config.js');
            let configContent = fs.readFileSync(configPath, 'utf8');
            
            configContent = configContent.replace(
                /minAccountAgeDays:\s*\d+/,
                `minAccountAgeDays: ${days}`
            );
            
            fs.writeFileSync(configPath, configContent, 'utf8');

            const embed = new EmbedBuilder()
                .setTitle('✅ Account Age Requirement Updated')
                .setDescription(days === 0 
                    ? 'All Discord accounts can post images regardless of age.' 
                    : `Discord accounts must be **${days} days** old to post images/attachments.`)
                .setColor('#00ff00')
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'toggle') {
            const enabled = interaction.options.getBoolean('enabled');
            
            config.moderation.scam_guard.enabled = enabled;

            const configPath = path.resolve(__dirname, '../../config.js');
            let configContent = fs.readFileSync(configPath, 'utf8');
            
            configContent = configContent.replace(
                /enabled:\s*(true|false)/,
                `enabled: ${enabled}`
            );
            
            fs.writeFileSync(configPath, configContent, 'utf8');

            const embed = new EmbedBuilder()
                .setTitle(enabled ? '✅ Scam Guard Enabled' : '❌ Scam Guard Disabled')
                .setDescription(enabled 
                    ? 'Image/attachment protection is now active.' 
                    : 'Scam guard has been disabled.')
                .setColor(enabled ? '#00ff00' : '#ff0000')
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'set-channels') {
            const channelsInput = interaction.options.getString('channels').trim();
            
            if (channelsInput.toLowerCase() === 'all') {
                config.moderation.scam_guard.monitorChannels = [];
            } else {
                const channelIds = channelsInput.split(',').map(id => id.trim()).filter(id => id.length > 0);
                config.moderation.scam_guard.monitorChannels = channelIds;
            }

            const configPath = path.resolve(__dirname, '../../config.js');
            let configContent = fs.readFileSync(configPath, 'utf8');
            
            const channelsArray = config.moderation.scam_guard.monitorChannels.length === 0 
                ? '[]' 
                : `['${config.moderation.scam_guard.monitorChannels.join("', '")}']`;
            
            configContent = configContent.replace(
                /monitorChannels:\s*\[.*?\]/,
                `monitorChannels: ${channelsArray}`
            );
            
            fs.writeFileSync(configPath, configContent, 'utf8');

            const embed = new EmbedBuilder()
                .setTitle('✅ Monitor Channels Updated')
                .setDescription(config.moderation.scam_guard.monitorChannels.length === 0 
                    ? 'Now monitoring **all channels** for scam images.' 
                    : `Now monitoring: ${config.moderation.scam_guard.monitorChannels.map(id => `<#${id}>`).join(', ')}`)
                .setColor('#00ff00')
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }
    }
}).toJSON();
