// This handler is now deprecated in favor of the Cloudflare Worker approach.
// To use AI locally, uncomment the code below and ensure GROQ_API_KEY is set in .env.

module.exports = new Event({
    event: 'messageCreate',
    once: false,
    run: async (client, message) => {
        // Local bot does not handle AI questions anymore to prevent conflicts with Cloudflare Worker.
        return;
    }
}).toJSON();
