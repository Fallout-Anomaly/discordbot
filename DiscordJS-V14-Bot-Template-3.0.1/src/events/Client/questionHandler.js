const { Events } = require('discord.js');
const Event = require('../../structure/Event');
const KnowledgeBase = require('../../utils/KnowledgeBase');
const AIService = require('../../utils/AIService');

// Initialize KnowledgeBase
// Using absolute path as per the workspace structure
const path = require('path');
// Initialize KnowledgeBase
// Using absolute path dynamically
// Initialize KnowledgeBase
// Using absolute path dynamically
const KB_PATH = path.join(__dirname, '../../knowledge');
const kb = new KnowledgeBase(KB_PATH);
// Preload
kb.load();

module.exports = new Event({
    event: 'messageCreate',
    once: false,
    run: async (client, message) => {
        // Ignore bots
        if (message.author.bot) return;

        // Check if we are in the Ask Channel (Dedicated Channel)
        const askChannelId = process.env.ASK_CHANNEL_ID;
        const isAskChannel = askChannelId && message.channel.id === askChannelId;

        // Check for Mentions (Any Channel)
        const isMentioned = message.mentions.has(client.user.id);

        // Process if: In Ask Channel OR Mentioned
        if (!isAskChannel && !isMentioned) return;

        // Visual feedback: Start typing
        await message.channel.sendTyping();

        try {
            // Remove the mention from the question text for cleaner processing
            let userQuestion = message.content;
            if (isMentioned) {
                userQuestion = userQuestion.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
            }

            // 1. Refine the question into search keywords
            // If AI is not available, this returns the original question
            const keywords = await AIService.refineQuestion(userQuestion);
            
            // 2. Search the knowledge base
            // Returns top 5 matches
            let results = kb.search(keywords);
            
            // Fallback: If no results with keywords, try original question
            if (results.length === 0 && keywords !== userQuestion) {
                 results = kb.search(userQuestion);
            }

            // 3. Generate Answer
            if (results.length > 0) {
                // Pass fullContent to AI Service
                const answer = await AIService.generateAnswer(userQuestion, results);
                
                // Reply to user
                // Split message if > 2000 chars
                const chunks = answer.match(/[\s\S]{1,2000}/g) || [];
                for (const chunk of chunks) {
                    await message.reply(chunk);
                }
            } else {
                // No results found
                await message.reply("I couldn't find any documentation relevant to your question. Please try rephrasing or be more specific.");
            }
        } catch (error) {
            console.error("Error in questionHandler:", error);
            await message.reply("Something went wrong while processing your question.");
        }
    }
}).toJSON();
