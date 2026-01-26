const KnowledgeBase = require('../src/utils/KnowledgeBase');
const path = require('path');

const KB_PATH = path.join(__dirname, '../src/knowledge');
const kb = new KnowledgeBase(KB_PATH);

console.log("Loading Knowledge Base...");
(async () => {
    await kb.load();

    const queries = [
    "how do i heal",
    "save game",
    "vafs key",
    "naked raiders",
    "stuck in animation"
];

    queries.forEach(query => {
        console.log(`\n--- Search for: "${query}" ---`);
        const results = kb.search(query);
        if (results.length > 0) {
            results.forEach((res, i) => {
                console.log(`${i+1}. ${res.fullName} (Score: ${res.score})`);
            });
        } else {
            console.log("No results found.");
        }
    });
})();
