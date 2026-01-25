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

        try {
            const response = await this.openai.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { 
                        role: 'system', 
                        content: 'You are a technical assistant. The user is asking a question about the bot or its features. Output a string of 2-5 search keywords that would best find the relevant content in the documentation. Do not output anything else.' 
                    },
                    { role: 'user', content: userQuestion }
                ],
                max_tokens: 20
            });
            return response.choices[0].message.content.trim();
        } catch (e) {
            console.error("AI Refine Error:", e.message);
            return userQuestion;
        }
    }

    async generateAnswer(userQuestion, contextItems) {
        // Prepare context
        const contextString = contextItems.map(item => {
            return `Name: ${item.fullName}\nType: ${item.type}\nContent: ${item.fullContent || item.description}\n`;
        }).join("\n---\n");

        if (!this.openai) {
            return `**No AI Key Found**\nI've found these relevant documentation items but cannot generate a full answer without a Groq API Key.\n\n${contextItems.map(i => `**${i.fullName}** (${i.type})`).join('\n')}`;
        }

        try {
            const response = await this.openai.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: `You are 'Anomaly Support', a helpful assistant for the 'Fallout Anomaly' modpack.
- Answer the user's question using ONLY the provided Context.
- Do NOT mention internal filenames (e.g., "gameplay-faq.md") or say "According to the documentation". Just give the answer naturally.
- If the context answers the question, explain it clearly.
- If the context is missing info, politely say you don't know based on the current guides.
- Do NOT provide Discord.js code unless explicitly asked.`
                    },
                    {
                        role: 'user', 
                        content: `Context:\n${contextString}\n\nQuestion: ${userQuestion}`
                    }
                ]
            });
            return response.choices[0].message.content.trim();
        } catch (e) {
            console.error("AI Generate Error:", e.message);
            return "I encountered an error while trying to generate the answer. Please check the logs.";
        }
    }
}

module.exports = new AIService();
