require('dotenv').config();
const KnowledgeBase = require('./src/utils/KnowledgeBase');
const path = require('path');
const { OpenAI } = require('openai');

const kbPath = path.join(__dirname, 'src/knowledge');
const kb = new KnowledgeBase(kbPath);
kb.load();

const openai = new OpenAI({ 
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1' 
});

async function run() {
    const question = "How do I save my game";
    const results = kb.search(question);
    
    console.log("Docs found:", results.length);
    results.forEach(r => console.log(`- ${r.fullName}: ${r.description.substring(0, 50)}...`));

    const contextString = results.map(item => {
        return `Name: ${item.fullName}\nType: ${item.type}\nContent: ${item.description}\n`;
    }).join("\n---\n");

    try {
        const response = await openai.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: `You are a helpful assistant for the Fallout Anomaly modpack. 
IMPORTANT: You MUST answer the user's question using ONLY the information provided in the Context below.
- Do not make up information.
- If the context contains the answer, verify it and explain it clearly.
- Use bullet points if helpful.`
                },
                {
                    role: 'user', 
                    content: `Context:\n${contextString}\n\nQuestion: ${question}`
                }
            ]
        });
        console.log("\nAI Response:\n", response.choices[0].message.content);
    } catch (e) {
        console.error(e);
    }
}

run();
