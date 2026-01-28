const { OpenAI } = require('openai');
require('dotenv').config();
const { QUEST_TEMPLATES } = require('./Constants');

/**
 * Service for interacting with AI models (Groq/OpenAI compatible)
 * Handles question refinement, answer generation, and quest creation.
 */
class AIService {
    /**
     * Initializes the AIService and OpenAI client if API key is present.
     */
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

    /**
     * Sanitizes user input to prevent prompt injection and remove problematic patterns.
     * @param {string} input - Raw user input
     * @returns {string} Sanitized input
     */
    sanitizeInput(input) {
        if (!input) return "";
        return input.toString()
            .replace(/ignore previous instructions/gi, "[REDACTED]")
            .replace(/forget everything/gi, "[REDACTED]")
            .replace(/system: /gi, "[REDACTED]")
            .replace(/assistant: /gi, "[REDACTED]")
            .replace(/user: /gi, "[REDACTED]")
            .trim();
    }

    /**
     * Refines a raw question into a set of search keywords.
     * @param {string} userQuestion - Original user question
     * @returns {string} Comma-separated search keywords
     */
    async refineQuestion(userQuestion) {
        if (!this.openai) return this.sanitizeInput(userQuestion);

        const model = 'llama-3.1-8b-instant';
        const sanitized = this.sanitizeInput(userQuestion);

        try {
            const response = await this.openai.chat.completions.create({
                model: model,
                messages: [
                    { 
                        role: 'system', 
                        content: 'You are a Fallout Anomaly assistant. Analyze the user question and output 3-6 search keywords/phrases that would find relevant Anomaly modpack documentation. Keywords should target: specific systems (MCM, UI, Economy), features (perks, traits, power armor, radiation), troubleshooting (crashes, F4SE, version issues), or controls. Do NOT output anything else - only keywords separated by commas.' 
                    },
                    { role: 'user', content: sanitized }
                ],
                max_tokens: 30
            }, { timeout: 10000 });
            return response.choices[0].message.content.trim();
        } catch (e) {
            console.error("AI Refine Error:", e);
            return sanitized;
        }
    }

    /**
     * Generates a detailed answer based on documentation context and conversation history.
     * @param {string} userQuestion - Current user question
     * @param {Array} contextItems - Relevant documentation snippets
     * @param {Array} history - Previous messages in the thread
     * @returns {Object} { answer: string, needsEscalation: boolean, contextQuality: string }
     */
    async generateAnswer(userQuestion, contextItems, history = []) {
        if (!Array.isArray(contextItems)) {
            console.error("AI Generate Error: Invalid context items format.");
            return { answer: "I encountered an internal error (invalid context).", needsEscalation: true, contextQuality: 'error' };
        }

        const sanitizedQuestion = this.sanitizeInput(userQuestion);

        // Prepare context
        const contextString = contextItems.map(item => {
            return `Name: ${item.fullName}\nType: ${item.type}\nContent: ${item.fullContent || item.description}\n`;
        }).join("\n---\n");

        if (!this.openai) {
            return `**No AI Key Found**\nI've found these relevant documentation items but cannot generate a full answer without a Groq API Key.\n\n${contextItems.map(i => `**${i.fullName}** (${i.type})`).join('\n')}`;
        }

        const model = 'llama-3.1-8b-instant'; // Forced to 8B to avoid 70B rate limits
        const maxTokens = parseInt(process.env.AI_MAX_TOKENS) || 500;

        // Check if a staff member has already responded in the conversation history
        // Staff responses are typically longer and contain technical guidance
        const hasStaffResponse = history.some(msg => {
            const content = (msg.content || '').toLowerCase();
            // Look for indicators of staff guidance (MCM, settings, troubleshooting steps, etc.)
            return msg.role === 'user' && (
                content.includes('mcm') || 
                content.includes('visor') || 
                content.includes('settings') ||
                content.includes('go to') ||
                content.includes('try this') ||
                content.includes('workaround') ||
                content.includes('settings') ||
                content.length > 300 // Staff responses tend to be detailed
            );
        });

        // Construct messages array
        const messages = [
            {
                role: 'system',
                content: `You are 'Anomaly Support', the official AI assistant for the **Fallout Anomaly modpack** - a hardcore survival mod for Fallout 4.

**YOUR EXPERTISE:**
- Fallout Anomaly-specific mechanics: S.P.E.C.I.A.L., perks, traits, power armor, radiation system, UI/MCM controls
- Installation & troubleshooting: F4SE versions, mod conflicts, crash logs, version compatibility
- Gameplay systems: Economy (caps), inventory management, scavenging, power armor crafting, quests
- Controls: Steam Input, gamepad support, keyboard binds for UI/Pipboy access

**IMPORTANT BEHAVIORS:**
1. **Check Context FIRST** - Always look at the provided documentation (Context) for answers. It's your primary source.
2. **Be Specific** - Reference exact MCM menu names, console commands, or step-by-step instructions from the docs.
3. **Acknowledge Limits** - If the Context doesn't have the answer, say "The documentation doesn't have details on this, but..." and provide general Fallout modding advice (clearly marked as general advice).
4. **Controller/Gamepad Issues** - When users mention controller problems, check the context for:
   - Steam Input links (steam://controllerconfig/...)
   - Specific button names (Select = Pipboy, etc.)
   - In-game keybind reset instructions
5. **Installation Issues** - For F4SE errors (especially "out of date" messages), reference the install FAQ from context and mention the correct version for this modpack.
6. **Technical Troubleshooting** - For crashes or errors:
   - Ask about F4SE version, load order, and recent mods added
   - Reference crash log analysis from documentation if available
   - Never assume - ask clarifying questions

**ESCALATION - Use [ESCALATE_TO_STAFF] ONLY if:**
- Question requires human judgment (ban appeals, account issues, moderation)
- User explicitly requests a human staff member
- A staff member already responded but user needs clarification
- Issue is complex, nuanced, or outside typical Anomaly support
**CRITICAL: NEVER say "I'll escalate" without the [ESCALATE_TO_STAFF] marker. If you include it, end your message with ONLY the marker - no text after.**

**CONVERSATION CONTEXT:**
- You can see up to 5 previous messages in this thread (short-term memory)
- You can learn new information if a staff member reacts with 🧠 emoji
${hasStaffResponse ? '- **⚠️ Staff has already responded here** - Do NOT repeat their answer. If the user is asking for clarification, escalate.' : ''}

**TONE:** Friendly, professional, knowledgeable. You are an expert on this modpack specifically.`
            }
        ];

        // Add history
        history.forEach(msg => messages.push({ role: msg.role, content: msg.content }));

        // Add current context and question
        messages.push({
            role: 'user',
            content: `Context:\n${contextString}\n\nQuestion: ${sanitizedQuestion}`
        });

        try {
            const response = await this.openai.chat.completions.create({
                model: model,
                messages: messages,
                max_tokens: maxTokens
            }, { timeout: 30000 }); // 30s timeout

            const content = response.choices[0].message.content.trim();
            
            // Check if AI requested escalation
            const needsEscalation = content.includes('[ESCALATE_TO_STAFF]');
            const cleanedContent = content.replace('[ESCALATE_TO_STAFF]', '').trim();
            
            return {
                answer: cleanedContent,
                needsEscalation: needsEscalation,
                contextQuality: contextItems.length > 0 ? 'good' : 'poor'
            };
        } catch (e) {
            console.error("AI Generate Error:", e);
            return {
                answer: "I encountered an error while trying to generate the answer. Please try again later.",
                needsEscalation: true,
                contextQuality: 'error'
            };
        }
    }

    /**
     * Generates a Radiant Quest JSON object using AI.
     * @param {Object} userParams - Parameters like level and weapon
     * @returns {Object} JSON quest object
     */
    async generateQuest(userParams) {
        if (!this.openai) {
             // Fallback quest if AI is offline
             const template = QUEST_TEMPLATES[Math.floor(Math.random() * QUEST_TEMPLATES.length)];
             return {
                 ...template,
                 flavor: "Communications array offline. Using pre-war protocols."
             };
        }

        const model = 'llama-3.1-8b-instant'; // Forced to 8B
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

            let content = response.choices[0].message.content.trim();
            
            // Sanitize: Remove markdown code blocks if present
            if (content.startsWith('```')) {
                content = content.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
            }
            
            return JSON.parse(content);
        } catch (e) {
            console.error("AI Quest Gen Error:", e);
            const template = QUEST_TEMPLATES[Math.floor(Math.random() * QUEST_TEMPLATES.length)];
            return {
                 ...template,
                 flavor: "Data corrupted. Fallback instructions loaded."
            };
        }
    }
}

module.exports = new AIService();
