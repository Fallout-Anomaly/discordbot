import { KNOWLEDGE_BASE } from './knowledge.js';

// IDF Pre-computation (Simplified)
// In a real app we'd build this once at build time. Here we do it on load.
const IDF_MAP = new Map();
const TOTAL_DOCS = KNOWLEDGE_BASE.length;
const ALL_DOCS_TEXT = KNOWLEDGE_BASE.map(d => `${d.name} ${d.keywords.join(' ')} ${d.content}`.toLowerCase());

ALL_DOCS_TEXT.forEach(text => {
    const words = new Set(text.split(/[^a-z0-9]+/));
    words.forEach(w => {
        IDF_MAP.set(w, (IDF_MAP.get(w) || 0) + 1);
    });
});

// Calculate IDF Score for a term: log(N / df)
const getIDF = (term) => {
    const df = IDF_MAP.get(term) || 0;
    if (df === 0) return 0;
    return Math.log10(TOTAL_DOCS / df);
};

export function searchKB(query) {
  // Sanitize input: remove non-alphanumeric chars (keep spaces)
  const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const results = [];

  const STOP_WORDS = new Set([
     'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at', 
     'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 
     'can', 'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 
     'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 
     'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 
     'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 
     'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 
     'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such', 
     'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too', 
     'under', 'until', 'up', 'very', 
     'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 
     'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
  ]);

  const queryTerms = q.split(/\s+/).filter(word => !STOP_WORDS.has(word) && word.length > 2);

  if (queryTerms.length === 0) return [];

  for (const doc of KNOWLEDGE_BASE) {
    let score = 0;
    const docName = doc.name.toLowerCase();
    const docContent = doc.content.toLowerCase();
    
    // Exact Phrase Match Bonus
    if (docContent.includes(q)) score += 50;

    for (const term of queryTerms) {
        let termScore = 0;
        const idf = getIDF(term);
        
        // TF (Title)
        if (docName.includes(term)) termScore += 10;
        
        // TF (Keywords)
        if (doc.keywords.includes(term)) termScore += 5;

        // TF (Content)
        // Count occurrences (capped at 5 for performance)
        const matches = docContent.split(term).length - 1;
        if (matches > 0) termScore += (matches * 1);

        // Apply IDF Weight
        score += termScore * (1 + idf);
    }

    if (score > 1) {
      results.push({ fullName: doc.name, fullContent: doc.content, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 3);
}

export async function askAI(userQuestion, env) {
  try {
    const contextItems = searchKB(userQuestion);
    
    // Threshold Check
    if (contextItems.length === 0 || contextItems[0].score < 5) {
        return "I'm sorry, I couldn't find any information in my knowledge base relevant to your query. Please try different keywords or use `/report` to ask staff.";
    }

    const contextString = contextItems.map(item => `[Doc: ${item.fullName} (Score: ${item.score.toFixed(1)})]\n${item.fullContent}`).join("\n---\n");


    console.log(`[AI] Context length: ${contextString.length}`);

    const model = env.GROQ_MODEL;
    const maxTokens = parseInt(env.AI_MAX_TOKENS);
    const timeout = parseInt(env.AI_TIME_LIMIT);

    if (!model || !maxTokens || !timeout) {
         console.warn('[AI] Missing AI Environment Variables. Using defaults.');
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'llama-3.3-70b-versatile',
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
        max_tokens: maxTokens || 4096
      })
    }, { signal: AbortSignal.timeout(timeout || 10000) });

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
