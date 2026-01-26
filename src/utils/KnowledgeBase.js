const fs = require('fs');
const path = require('path');

const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'for', 'is', 'it', 'in', 'on', 'at', 'to', 'from', 'with', 'by', 'of', 'how', 'do', 'i', 'the', 'that', 'this', 'there', 'what', 'where']);

class KnowledgeBase {
    constructor(knowledgeDir) {
        this.knowledgeDir = knowledgeDir;
        this.index = [];
        this.documentFrequency = new Map();
        this.totalDocuments = 0;
        this.loaded = false;
        this.loadingPromise = null;
        this.extensions = (process.env.KB_EXTENSIONS || '.txt,.md,.json').split(',');
    }

    /**
     * Converts text into a clean array of relevant tokens
     * @param {string} text 
     * @returns {string[]}
     */
    tokenize(text) {
        if (!text) return [];
        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Remove non-word chars
            .split(/\s+/)
            .filter(word => word.length > 2 && !STOP_WORDS.has(word));
    }

    /**
     * Calculates term frequencies for a list of tokens
     * @param {string[]} tokens 
     * @returns {Map<string, number>}
     */
    getTermFrequencies(tokens) {
        const freq = new Map();
        for (const token of tokens) {
            freq.set(token, (freq.get(token) || 0) + 1);
        }
        return freq;
    }

    async load() {
        if (this.loaded) return;
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = (async () => {
            try {
                try {
                    await fs.promises.access(this.knowledgeDir);
                } catch {
                    console.error(`KnowledgeBase directory not found at ${this.knowledgeDir}`);
                    await fs.promises.mkdir(this.knowledgeDir, { recursive: true });
                    console.log("Created knowledge base directory.");
                    return;
                }

                const files = await fs.promises.readdir(this.knowledgeDir);
                const tempIndex = [];
                const tempDocFreq = new Map();

                for (const file of files) {
                    if (this.extensions.some(ext => file.endsWith(ext.trim()))) {
                        const filePath = path.join(this.knowledgeDir, file);
                        const content = await fs.promises.readFile(filePath, 'utf8');
                        
                        const tokens = this.tokenize(content);
                        const termFreqs = this.getTermFrequencies(tokens);
                        
                        // Extract filename tokens for special matching
                        const filenameTokens = this.tokenize(file.replace(/\.[^/.]+$/, ""));

                        tempIndex.push({
                            name: file,
                            content: content,
                            termFreqs: termFreqs,
                            totalTokens: tokens.length,
                            filenameTokens: filenameTokens
                        });

                        // Update global document frequencies
                        for (const term of termFreqs.keys()) {
                            tempDocFreq.set(term, (tempDocFreq.get(term) || 0) + 1);
                        }
                    }
                }

                this.index = tempIndex;
                this.documentFrequency = tempDocFreq;
                this.totalDocuments = tempIndex.length;
                this.loaded = true;
                console.log(`Knowledge Base indexed: ${this.totalDocuments} docs (Advanced Search Enabled)`);
            } catch (error) {
                console.error("Failed to load knowledge base:", error);
                this.index = [];
            } finally {
                this.loadingPromise = null;
            }
        })();

        return this.loadingPromise;
    }

    search(query) {
        if (!this.loaded) {
            console.warn("KnowledgeBase search called before load complete.");
            return [];
        }
        
        const queryTokens = this.tokenize(query);
        if (queryTokens.length === 0) return [];

        const results = [];

        for (const doc of this.index) {
            let score = 0;
            
            // 1. TF-IDF Scoring for content
            for (const token of queryTokens) {
                const tf = doc.termFreqs.get(token) || 0;
                if (tf > 0) {
                    const df = this.documentFrequency.get(token) || 1;
                    const idf = Math.log(this.totalDocuments / df);
                    // Weight: TF * (IDF + 1)
                    score += tf * (idf + 1);
                }
            }

            // 2. Extra boost for filename matches
            for (const token of queryTokens) {
                if (doc.filenameTokens.includes(token)) {
                    score += 50; // Significant bonus for term in filename
                }
            }

            // 3. Bonus for exact phrases? (Simple implementation)
            const contentLower = doc.content.toLowerCase();
            const queryLower = query.toLowerCase().trim();
            if (contentLower.includes(queryLower)) {
                score += 100; // Big bonus for exact string match
            }

            if (score > 0) {
                results.push({ 
                    fullName: doc.name,
                    type: 'Documentation',
                    description: doc.content.substring(0, 500) + '...',
                    fullContent: doc.content,
                    score 
                });
            }
        }

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, 3);
    }
}

module.exports = KnowledgeBase;
