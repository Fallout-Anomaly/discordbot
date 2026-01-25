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
  if (!env.GROQ_API_KEY) return "AI key not configured in Cloudflare secrets.";

  try {
    // 1. Refine question using direct fetch
    let refinedQuery = userQuestion;
    const refineResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-r1-distill-llama-70b',
        messages: [
          { role: 'system', content: 'Output 2-5 search keywords for the user question. Only output keywords.' },
          { role: 'user', content: userQuestion }
        ],
        max_tokens: 20
      })
    });

    if (refineResponse.ok) {
        const data = await refineResponse.json();
        refinedQuery = data.choices[0].message.content.trim();
    }

    // 2. Search KB
    const contextItems = searchKB(refinedQuery);
    const contextString = contextItems.map(item => {
      return `Name: ${item.fullName}\nContent: ${item.fullContent}\n`;
    }).join("\n---\n");

    // 3. Generate Answer using DeepSeek R1 (Llama 70B Distill)
    const answerResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-r1-distill-llama-70b',
          messages: [
            {
              role: 'system',
              content: `You are 'Anomaly Support', a high-performance support AI for the 'Fallout Anomaly' modpack.
You MUST think through the user's problem step-by-step using the provided Context.
- Answer using ONLY the provided Context.
- Provide clear, numbered troubleshooting steps if appropriate.
- Do NOT mention internal filenames or say "Based on the documentation".
- If the context doesn't have the answer, politely guide the user to the staff team.`
            },
            {
              role: 'user', 
              content: `Context:\n${contextString}\n\nQuestion: ${userQuestion}`
            }
          ],
          temperature: 0.6
        })
      });

    if (!answerResponse.ok) {
        const err = await answerResponse.text();
        return `Groq AI Error (${answerResponse.status}): ${err.substring(0, 100)}`;
    }

    const answerData = await answerResponse.json();
    return answerData.choices[0].message.content.trim();

  } catch (e) {
    return `Worker Error: ${e.message}`;
  }
}
