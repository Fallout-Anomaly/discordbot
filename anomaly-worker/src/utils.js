import { KNOWLEDGE_BASE } from './knowledge.js';

export function searchKB(query) {
  const q = query.toLowerCase().trim();
  const results = [];

  for (const doc of KNOWLEDGE_BASE) {
    let score = 0;
    if (doc.name.toLowerCase().includes(q)) score += 50;
    const contentLower = doc.content.toLowerCase();
    if (contentLower.includes(q)) score += 20;

    const queryParts = q.split(' ').filter(word => 
      !['is', 'at', 'the', 'of', 'in', 'and', 'a', 'to', 'for', 'on'].includes(word) && word.length > 2
    );
    for (const part of queryParts) {
      if (doc.keywords.includes(part)) score += 10;
      if (contentLower.includes(part)) score += 5;
    }

    if (score > 0) {
      results.push({ fullName: doc.name, fullContent: doc.content, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 3);
}

export async function askAI(userQuestion, env) {
  try {
    // 1. Single AI call (Faster/Reliable)
    // We send the top search results directly and let the reasoning model filter
    const contextItems = searchKB(userQuestion);
    const contextString = contextItems.map(item => `[Doc: ${item.fullName}]\n${item.fullContent}`).join("\n---\n");

    console.log(`[AI] Context length: ${contextString.length}`);

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are 'Anomaly Support'. 
- Answer the user's question using ONLY the provided Context.
- If the context doesn't have the answer, politely guide them to staff.
- Think step-by-step for complex issues.`
          },
          {
            role: 'user', 
            content: `Context:\n${contextString}\n\nQuestion: ${userQuestion}`
          }
        ],
        temperature: 0.6,
        max_tokens: 4096 // Ensure reasoning can actually fit
      })
    }, { signal: AbortSignal.timeout(10000) }); // 10-second timeout

    if (!res.ok) {
        const err = await res.text();
        return `Groq API Error: ${res.status} - ${err.substring(0, 100)}`;
    }

    const data = await res.json();
    return data.choices[0].message.content.trim();

  } catch (e) {
    console.error("[AI] Fatal Error:", e);
    return `Critical Error: ${e.message}`;
  }
}
