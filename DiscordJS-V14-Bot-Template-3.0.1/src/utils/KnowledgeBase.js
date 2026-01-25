const fs = require('fs');
const path = require('path');

class KnowledgeBase {
    constructor(knowledgeDir) {
        this.knowledgeDir = knowledgeDir;
        this.index = [];
        this.loaded = false;
    }

    load() {
        if (this.loaded) return;
        try {
            if (!fs.existsSync(this.knowledgeDir)) {
                console.error(`KnowledgeBase directory not found at ${this.knowledgeDir}`);
                // Attempt to create it if it doesn't exist
                fs.mkdirSync(this.knowledgeDir, { recursive: true });
                console.log("Created knowledge base directory.");
                return;
            }

            const files = fs.readdirSync(this.knowledgeDir);
            this.index = [];

            for (const file of files) {
                if (file.endsWith('.txt') || file.endsWith('.md') || file.endsWith('.json')) {
                    const filePath = path.join(this.knowledgeDir, file);
                    const content = fs.readFileSync(filePath, 'utf8');
                    
                    this.index.push({
                        name: file,
                        content: content,
                        keywords: file.toLowerCase().replace(/\.[^/.]+$/, "").split(/[\s-_]+/)
                    });
                }
            }

            this.loaded = true;
            console.log(`Knowledge Base loaded: ${this.index.length} documents indexed.`);
        } catch (error) {
            console.error("Failed to load knowledge base:", error);
            this.index = [];
        }
    }

    search(query) {
        if (!this.loaded) this.load();
        
        const q = query.toLowerCase().trim();
        const results = [];

        for (const doc of this.index) {
            let score = 0;
            
            // Keyword match in filename
            if (doc.name.toLowerCase().includes(q)) score += 50;
            
            // Content match
            const contentLower = doc.content.toLowerCase();
            if (contentLower.includes(q)) score += 20;

            // Split query search
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
                    description: doc.content.substring(0, 500) + '...', // Preview
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
