const AIService = require('./src/utils/AIService');

async function testAI() {
    console.log("Testing AI Service with Groq...");
    
    // Simulate a simple question and context
    const question = "How do I save my game in Survival mode?";
    const context = [
        {
            fullName: "gameplay-faq.md",
            type: "Knowledge Base",
            description: "To save: Sleep in a bed or smoke a cigarette (hold H for radial menu)."
        }
    ];

    console.log(`Question: ${question}`);
    console.log("Generating answer...");

    try {
        const answer = await AIService.generateAnswer(question, context);
        console.log("\n--- AI Response ---\n");
        console.log(answer);
        console.log("\n-------------------\n");
        
        if (answer.includes("No AI Key Found") || answer.includes("error")) {
            console.error("❌ AI Test Failed");
        } else {
            console.log("✅ AI Test Passed");
        }

    } catch (error) {
        console.error("CRITICAL ERROR:", error);
    }
}

testAI();
