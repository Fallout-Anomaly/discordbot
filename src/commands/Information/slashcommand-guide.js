const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'guide',
        description: 'Check out the interactive Survivor\'s Guide to all available commands.',
    },
    run: async (client, interaction) => {
        const commands = client.collection.application_commands;
        const categories = {};

        // Group commands by folder if possible, currently we flat list them or map them manually.
        // Let's manually categorize for better UX based on naming convention
        
        commands.forEach((cmd) => {
            const name = cmd.command.name;
            let category = '🔧 Utility';

            if (['ban', 'kick', 'mute', 'timeout', 'lock', 'unlock', 'clear', 'setup-verify'].includes(name)) category = '🛡️ Moderation';
            else if (['balance', 'pay', 'daily', 'coinflip', 'slots', 'leaderboard'].includes(name)) category = '💰 Economy';
            else if (['scavenge', 'stats', 'inventory', 'shop'].includes(name)) category = '☢️ RPG & Survival';
            else if (['embed', 'say', 'verify'].includes(name)) category = '🛠️ Tools';
            
            if (!categories[category]) categories[category] = [];
            categories[category].push(`\`/${name}\` - ${cmd.command.description}`);
        });

        const embed = new EmbedBuilder()
            .setTitle('📖 Survivor\'s Field Guide')
            .setDescription('Welcome to the wasteland! Here are the tools at your disposal:')
            .setColor('#27ae60')
            .setThumbnail('https://i.imgur.com/8Q9Q2Xn.png') // Optional: Pip-Boy icon
            .setFooter({ text: 'Use /report to contact staff for help.' });

        for (const [category, cmds] of Object.entries(categories)) {
            embed.addFields({ name: category, value: cmds.join('\n') });
        }

        interaction.reply({ embeds: [embed] });
    }
}).toJSON();
