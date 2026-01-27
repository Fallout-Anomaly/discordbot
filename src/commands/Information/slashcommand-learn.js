const fs = require('fs');
const path = require('path');
const ApplicationCommand = require("../../structure/ApplicationCommand");
const { ApplicationCommandOptionType, PermissionFlagsBits } = require("discord.js");

module.exports = new ApplicationCommand({
    command: {
        name: 'learn',
        description: 'Add new information to the bot knowledge base.',
        options: [
            {
                name: 'topic',
                description: 'Short topic or title (e.g. "Pipboy Flashlight Fix").',
                type: ApplicationCommandOptionType.String,
                required: true
            },
            {
                name: 'content',
                description: 'The explanation or solution to remember.',
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ],
        defaultMemberPermissions: PermissionFlagsBits.ManageMessages // Restrict to mods/admins
    },
    run: async (client, interaction) => {
        // Double check permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: '❌ Only staff can teach the bot.', ephemeral: true });
        }

        const topic = interaction.options.getString('topic');
        const content = interaction.options.getString('content');

        const knowledgePath = path.join(__dirname, '../../../knowledge/LearnedContext.txt');
        
        // Format the new entry
        const entry = `\n\n--- [Learned] ${topic} ---\n${content}`;

        try {
            await interaction.deferReply({ ephemeral: true });

            await fs.promises.appendFile(knowledgePath, entry, 'utf8');
            
            // Trigger reload
            const count = await client.knowledge.reload();

            interaction.editReply({ content: `✅ **Learned!**\nAdded "${topic}" to the knowledge base.\nThe bot has re-indexed ${count} documents.` });

        } catch (err) {
            console.error(err);
            interaction.editReply({ content: '❌ Failed to save knowledge. Check console.' });
        }
    }
}).toJSON();
