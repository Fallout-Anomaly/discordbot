const { OpenAI } = require('openai');
require('dotenv').config();

class AIService {
    constructor() {
        this.openai = null;
        if (process.env.GROQ_API_KEY) {
            this.openai = new OpenAI({ 
                apiKey: process.env.GROQ_API_KEY,
                baseURL: 'https://api.groq.com/openai/v1' 
            });
        } else {
            console.warn("GROQ_API_KEY is missing. AI features will be disabled or simulated.");
        }
    }

    async refineQuestion(userQuestion) {
        if (!this.openai) return userQuestion;

        const model = process.env.AI_MODEL_REFINE || 'llama-3.1-8b-instant'; // Use lighter model for refinement

        try {
            const response = await this.openai.chat.completions.create({
                model: model,
                messages: [
                    { 
                        role: 'system', 
                        content: 'You are a technical assistant. The user is asking a question about the bot or its features. Output a string of 2-5 search keywords that would best find the relevant content in the documentation. Do not output anything else.' 
                    },
                    { role: 'user', content: userQuestion }
                ],
                max_tokens: 20
            }, { timeout: 10000 }); // 10s timeout
            return response.choices[0].message.content.trim();
        } catch (e) {
            console.error("AI Refine Error:", e.message);
            return userQuestion;
        }
    }

    async generateAnswer(userQuestion, contextItems) {
        if (!Array.isArray(contextItems)) {
            console.error("AI Generate Error: Invalid context items format.");
            return "I encountered an internal error (invalid context).";
        }

        // Prepare context
        const contextString = contextItems.map(item => {
            return `Name: ${item.fullName}\nType: ${item.type}\nContent: ${item.fullContent || item.description}\n`;
        }).join("\n---\n");

        if (!this.openai) {
            return `**No AI Key Found**\nI've found these relevant documentation items but cannot generate a full answer without a Groq API Key.\n\n${contextItems.map(i => `**${i.fullName}** (${i.type})`).join('\n')}`;
        }

        const model = process.env.AI_MODEL_ANSWER || 'llama-3.3-70b-versatile'; // Stronger model for generation
        const maxTokens = parseInt(process.env.AI_MAX_TOKENS) || 500;

        try {
            const response = await this.openai.chat.completions.create({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: `You are 'Anomaly Support', a helpful assistant for the 'Fallout Anomaly' modpack.
- Answer using ONLY the provided Context.
- Provide clear troubleshooting steps if appropriate.
- Do NOT mention filenames or say "Based on the context". 
- If context is missing info, guide the user to look at the website or ask for help in the support channel within the discord.`
                    },
                    {
                        role: 'user', 
                        content: `Context:\n${contextString}\n\nQuestion: ${userQuestion}`
                    }
                ],
                max_tokens: maxTokens
            }, { timeout: 30000 }); // 30s timeout

            return response.choices[0].message.content.trim();
        } catch (e) {
            console.error("AI Generate Error:", e.message);
            return "I encountered an error while trying to generate the answer. Please try again later.";
        }
    }
}

module.exports = new AIService();
