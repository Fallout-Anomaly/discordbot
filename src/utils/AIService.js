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

    async generateAnswer(userQuestion, contextItems, history = []) {
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

        const model = process.env.AI_MODEL_ANSWER || 'llama-3.1-8b-instant'; // Stronger model for generation
        const maxTokens = parseInt(process.env.AI_MAX_TOKENS) || 500;

        // Construct messages array
        const messages = [
            {
                role: 'system',
                content: `You are 'Anomaly Support', a helpful assistant for the 'Fallout Anomaly' modpack.
- **Guidelines**: Follow the 'Fallout Anomaly Support Guidelines' (Professionalism, Safety, and Respect). If asked about your rules or guidelines, provide a professional summary.
- **Capabilities**: You HAVE short-term memory (you can see the last 5 messages in this conversation). You can also LEARN new things if a staff member reacts to a message with the 🧠 emoji. 
- If asked about your memory or learning, explain that you have these features.
- First, check the provided Context for the answer.
- If the Context has the answer, use it exclusively.
- **Controller/Gamepad Support**: If asked about controllers, ALWAYS check the context for "Steam Input" links (steam://controllerconfig/...) or specific keybinds (e.g. "Select" for Pipboy). Remind users to reset in-game keybinds to default if mentioned in context.
- If the Context is missing specific details, you MAY use your general knowledge about Fallout 4 modding to help, but explicitly state that this is "general advice" and might differ in the modpack.
- Be concise and friendly.
- Do NOT mention filenames or say "Based on the context".`
            }
        ];

        // Add history
        history.forEach(msg => messages.push({ role: msg.role, content: msg.content }));

        // Add current context and question
        messages.push({
            role: 'user',
            content: `Context:\n${contextString}\n\nQuestion: ${userQuestion}`
        });

        try {
            const response = await this.openai.chat.completions.create({
                model: model,
                messages: messages,
                max_tokens: maxTokens
            }, { timeout: 30000 }); // 30s timeout

            return response.choices[0].message.content.trim();
        } catch (e) {
            console.error("AI Generate Error:", e.message);
            return "I encountered an error while trying to generate the answer. Please try again later.";
        }
    }

    async generateQuest(userParams) {
        if (!this.openai) {
             // Fallback quest if AI is offline
             return {
                 title: "Scavenge the Super Duper Mart",
                 description: "We need supplies. Head to the old Super Duper Mart and clear out any ghouls you find.",
                 objective: "Retrieve the supplies",
                 difficulty: "Easy",
                 flavor: "Don't get eaten."
             };
        }

        const model = process.env.AI_MODEL_REFINE || 'llama-3.1-8b-instant'; 

        try {
            const response = await this.openai.chat.completions.create({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: `You are the Overseer of a Fallout vault. Generate a short, interesting "Radiant Quest" for a wasteland explorer.
Output MUST be valid JSON only. format:
{
  "title": "Quest Title",
  "description": "Short flavor text describing the situation (max 2 sentences).",
  "objective": "What needs to be done (e.g. Kill X, Find Y).",
  "difficulty": "Easy" or "Medium" or "Hard",
  "flavor": "A witty closing remark.",
  "reward_item": "stimpak" or "10mm_rounds" or "purified_water" (optional ID from Fallout 4 items)
}`
                    },
                    {
                        role: 'user',
                        content: `Generate a quest. User Level: ${userParams.level || 1}. Current Weapon: ${userParams.weapon || 'Pipe Pistol'}.`
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 200
            }, { timeout: 15000 });

            const content = response.choices[0].message.content.trim();
            return JSON.parse(content);
        } catch (e) {
            console.error("AI Quest Gen Error:", e.message);
            return {
                 title: "Patrol the Perimeter",
                 description: "The sensors picked up movement. Go check it out.",
                 objective: "Patrol for 10 minutes",
                 difficulty: "Easy",
                 flavor: "Probably just a mole rat."
            };
        }
    }
}

module.exports = new AIService();
