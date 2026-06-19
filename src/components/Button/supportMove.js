const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const Component = require('../../structure/Component');
const config = require('../../config');
const strikes = require('../../utils/SupportStrikes');
const AIService = require('../../utils/AIService');
const { CRASH_LOG_INSTRUCTIONS } = require('../../utils/Constants');
const { error } = require('../../utils/Console');

// Original message IDs currently being moved — prevents a double-click from creating
// two forum threads before the nudge button is removed.
const inFlight = new Set();

// First-pass AI answer, posted into the freshly created forum thread. Reuses the
// exact same knowledge base + model the forum assistant uses, so moved questions
// get an instant answer instead of just sitting there. Best-effort: any failure
// here must never break the move itself.
async function postAiFirstPass(client, thread, question) {
    if (!client.knowledge || typeof client.knowledge.search !== 'function') return;
    await thread.sendTyping?.().catch(() => {});

    let contextItems = client.knowledge.search(question.toLowerCase()) || [];
    if (contextItems.length < 2) {
        const refined = await AIService.refineQuestion(question);
        const more = client.knowledge.search(String(refined).toLowerCase()) || [];
        contextItems = [...contextItems, ...more];
    }
    contextItems = Array.from(new Map(contextItems.map((i) => [i.fullName, i])).values()).slice(0, 3);

    const result = await AIService.generateAnswer(question, contextItems, []);
    const answer = typeof result === 'string' ? result : result.answer;
    if (!answer) return;
    const needsEscalation = typeof result === 'object' && result.needsEscalation;
    const sources = contextItems.length ? contextItems.map((i) => `**${i.fullName}**`).join(', ') : 'General Anomaly Knowledge';

    const embed = new EmbedBuilder()
        .setTitle('☢️ Anomaly AI Assistant')
        .setDescription(String(answer).slice(0, 4096))
        .setColor(needsEscalation ? '#e67e22' : '#3498db')
        .setFooter({ text: `📚 Sources: ${sources} • A first-pass answer — staff will follow up if needed.` })
        .setTimestamp();

    let content = null;
    if (needsEscalation) {
        const staffRole = config.roles?.staff_role || process.env.STAFF_ROLE_ID;
        if (staffRole) content = `<@&${staffRole}> this one may need a human.`;
    }
    await thread.send(content ? { content, embeds: [embed] } : { embeds: [embed] }).catch(() => {});
}

// Matches the dynamic IDs minted in events/Client/supportDeflect.js:
//   supportmove:<authorId>:<channelId>:<messageId>
module.exports = new Component({
    customId: /^supportmove:/,
    type: 'button',
    options: { public: true },
    run: async (client, interaction) => {
        // interactionCreate.js already defers the reply (ephemeral) before we run,
        // so everything below uses editReply. Guard the defer just in case that path
        // ever changes — otherwise editReply would throw.
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: 64 }).catch(() => {});
        }

        const [, authorId, channelId, messageId] = interaction.customId.split(':');

        // Only the original poster — or staff — may move the message.
        const member = interaction.member;
        const isStaff =
            member?.permissions?.has(PermissionsBitField.Flags.BanMembers) ||
            member?.permissions?.has(PermissionsBitField.Flags.Administrator) ||
            (config.roles?.staff_role && member?.roles?.cache?.has(config.roles.staff_role));
        if (interaction.user.id !== authorId && !isStaff) {
            return interaction.editReply({ content: '❌ Only the person who posted this (or staff) can move it.' }).catch(() => {});
        }

        // Guard against double-clicks racing two forum posts into existence before the
        // nudge (and its button) is deleted.
        if (inFlight.has(messageId)) {
            return interaction.editReply({ content: '⏳ Already moving this one — give me a second.' }).catch(() => {});
        }
        inFlight.add(messageId);

        try {
            const cfg = config.moderation?.support_deflect || {};
            const forumChannelId = cfg.forumChannelId || (config.channels?.forum_support || [])[0];
            const forum = await client.channels.fetch(forumChannelId).catch(() => null);
            if (!forum || !forum.isThreadOnly?.()) {
                return interaction.editReply({ content: '❌ The support forum is not configured correctly. Please ping staff.' }).catch(() => {});
            }

            // Recover the original message (it may have been deleted already).
            const sourceChannel = await client.channels.fetch(channelId).catch(() => null);
            const original = sourceChannel ? await sourceChannel.messages.fetch(messageId).catch(() => null) : null;
            const originalContent = (original?.content || '').trim();
            if (!originalContent) {
                return interaction.editReply({ content: "❌ I couldn't find the original message to move (it may have been deleted)." }).catch(() => {});
            }

            // Thread title from the first line. Discord forum thread names cap at 100 chars.
            const firstLine = originalContent.split('\n')[0].trim();
            let title = firstLine.length > 97 ? firstLine.slice(0, 94).trim() + '...' : firstLine;
            if (!title) title = 'Support request';

            // A forum starter message is a normal message: 2000-char limit. Keep room for the prefix.
            const body =
                `**Posted by <@${authorId}>** (moved from <#${channelId}>):\n\n` +
                originalContent.slice(0, 1800);

            let thread;
            try {
                thread = await forum.threads.create({
                    name: title,
                    message: { content: body },
                    appliedTags: cfg.defaultTagId ? [cfg.defaultTagId] : undefined,
                    reason: 'Support message moved from main chat'
                });
            } catch (e) {
                error(`[SUPPORT DEFLECT] Failed to create forum post: ${e.message}`);
                return interaction.editReply({ content: '❌ Failed to create the forum post. A forum tag may be required — please ping staff.' }).catch(() => {});
            }

            // They did the right thing — forgive their strikes so a cooperative user
            // never edges toward a timeout.
            strikes.clearStrikes(authorId);

            // Ping the author inside the new thread so they get notified to follow up there,
            // and tell them exactly how to attach a crash log (the launcher packages one for them).
            await thread.send({
                content: `<@${authorId}> your question has been moved here so it's easier to track.\n\n${CRASH_LOG_INSTRUCTIONS}`
            }).catch(() => {});

            // Clean up: remove the original message and the nudge with its button BEFORE the
            // (potentially slow) AI call, so the button can't be clicked again mid-flight.
            if (cfg.deleteOriginal !== false) {
                await original.delete().catch(() => {});
            }
            await interaction.message?.delete().catch(() => {});

            await interaction.editReply({ content: `✅ Moved to <#${thread.id}>. Continue the conversation there!` }).catch(() => {});

            // Let the AI take a first pass at the question right in the thread (best-effort,
            // non-blocking — the move is already confirmed above).
            if (cfg.aiAnswer !== false) {
                postAiFirstPass(client, thread, originalContent).catch((e) => error(`[SUPPORT DEFLECT] AI first-pass failed: ${e.message}`));
            }
        } finally {
            inFlight.delete(messageId);
        }
    }
}).toJSON();
