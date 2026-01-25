import { OpenAI } from 'openai';
import { KNOWLEDGE_BASE } from './knowledge.js';

export function searchKB(query) {
  const q = query.toLowerCase().trim();
  const results = [];

  for (const doc of KNOWLEDGE_BASE) {
    let score = 0;
    if (doc.name.toLowerCase().includes(q)) score += 50;
    
    const contentLower = doc.content.toLowerCase();
    if (contentLower.includes(q)) score += 20;

    const queryParts = q.split(' ');
    let keywordMatches = 0;
    for (const part of queryParts) {
      if (doc.keywords.includes(part)) keywordMatches++;
      if (contentLower.includes(part)) score += 5;
    }
    if (keywordMatches > 0) score += (keywordMatches * 10);

    if (score > 0) {
      results.push({ 
        fullName: doc.name,
        type: 'Documentation',
        fullContent: doc.content,
        score 
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 3);
}

export async function askAI(userQuestion, env) {
  if (!env.GROQ_API_KEY) return "AI key not configured.";

  const openai = new OpenAI({ 
    apiKey: env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1' 
  });

  // 1. Refine question for search
  let refinedQuery = userQuestion;
  try {
    const refineResponse = await openai.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a technical assistant. Output 2-5 search keywords for the user question. Only output keywords.' },
        { role: 'user', content: userQuestion }
      ],
      max_tokens: 20
    });
    refinedQuery = refineResponse.choices[0].message.content.trim();
  } catch (e) {}

  // 2. Search KB
  const contextItems = searchKB(refinedQuery);
  const contextString = contextItems.map(item => {
    return `Name: ${item.fullName}\nContent: ${item.fullContent}\n`;
  }).join("\n---\n");

  // 3. Generate Answer
  try {
    const response = await openai.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are 'Anomaly Support', a helpful assistant for the 'Fallout Anomaly' modpack.
- Answer the user's question using ONLY the provided Context.
- Do NOT mention internal filenames. Just give the answer naturally.
- If context is missing info, politely say you don't know.`
        },
        {
          role: 'user', 
          content: `Context:\n${contextString}\n\nQuestion: ${userQuestion}`
        }
      ]
    });
    return response.choices[0].message.content.trim();
  } catch (e) {
    return "Error generating AI response.";
  }
}
