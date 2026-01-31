const { Events, PermissionFlagsBits } = require('discord.js');
const Event = require('../../structure/Event');
const fs = require('fs');
const path = require('path');
const { error } = require('../../utils/Console');

module.exports = new Event({
    event: Events.MessageReactionAdd,
    once: false,
    run: async (client, reaction, user) => {
        // 1. Partial Handling (if message/reaction is old)
        if (reaction.partial) {
            try {
                await reaction.message.fetch();
            } catch {
                return;
            }
        }
        if (user.partial) {
            try {
                await user.fetch();
            } catch {
                return;
            }
        }

        // 2. Filter: Only work in Guilds
        if (!reaction.message.guild) return;

        // 3. Filter: Only 'brain' emoji or similar (🧠)
        if (reaction.emoji.name !== '🧠') return;

        // 4. Filter: User must be Staff (ManageMessages)
        const member = await reaction.message.guild.members.fetch(user.id);
        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

        // 5. Check if we already learned this (avoid duplicates if multiple brains added)
        // A simple rudimentary check or just rely on it being harmless to duplicate slightly.
        if (reaction.message.reactions.cache.get('✅')?.users.cache.has(client.user.id)) return;

        // 6. Save to Knowledge Base
        const content = reaction.message.content;
        const authorTag = reaction.message.author.tag;
        const msgLink = reaction.message.url;
        
        if (!content) return; // Skip empty messages (e.g. image only, unless we handle images later)

        const learningPath = path.join(process.cwd(), 'knowledge/LearnedContext.txt');
        const entry = `\n\n--- [Learned via Reaction] From ${authorTag} ---\nSource: ${msgLink}\nContent: ${content}`;

        try {
            await fs.promises.appendFile(learningPath, entry, 'utf8');
            
            // Reload KB
            await client.knowledge.reload();

            // Confirm if bot has permission
            if (reaction.message.channel.permissionsFor(client.user)?.has(PermissionFlagsBits.AddReactions)) {
                await reaction.message.react('✅').catch(() => {});
            }

        } catch (err) {
            error('[ReactionLearn] Failed to save:', err);
            if (reaction.message.channel.permissionsFor(client.user)?.has(PermissionFlagsBits.AddReactions)) {
                await reaction.message.react('❌').catch(() => {});
            }
        }
    }
}).toJSON();
