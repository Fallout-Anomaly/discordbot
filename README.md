# Anomaly Guardian AI ☢️

**Anomaly Guardian** is the central AI assistant and automation bot for the **Fallout Anomaly** modlist community.

Powered by advanced AI (Google Gemini via proxy) and Discord.js v14, it serves as the first line of defense for support, helping users with installation issues, gameplay mechanics, and modlist questions.

## ✨ Key Features
*   **🧠 AI Knowledge Base**: Context-aware AI responses based on scraped website data and internal documentation (Markdown/HTML).
*   **⚡ Auto Responder**: Instant trigger-based fixes for common issues (e.g., "Screen Resolution", "Crashes").
*   **💬 Support Channels**:
    *   **Ask Channel**: Conversational AI support.
    *   **Forum integration**: Auto-replies to new help threads.
*   **RPG Economy**: Caps, XP, Quests, Scavenging, and Inventory management.
*   **Moderation**: Verification, auto-roles, and logging.

## 🛠️ Technology Stack
*   **Core**: Node.js, Discord.js v14
*   **Database**: SQLite3 (Users, Inventory, Economy)
*   **AI**: Google Gemini Flash 1.5 (via OpenAI-compatible proxy)
*   **Config**: YAML storage & JSON configs

## 🚀 Setup & Installation
1.  **Clone the Repo**: `git clone ...`
2.  **Install Dependencies**: `npm install`
3.  **Configure**:
    *   Rename `.env.example` to `.env` and add your `CLIENT_TOKEN` and AI Keys.
    *   Update `src/config.js` with your Guild and Channel IDs.
4.  **Run**:
    *   `npm start` (Production)
    *   `node .` (Development)

## 📁 Structure
*   `src/client/` - Bot client wrapper and handlers.
*   `src/commands/` - Slash and Message commands.
*   `src/events/` - Event listeners (MessageCreate, InteractionCreate, etc.).
*   `src/knowledge/` - Markdown files feeding the RAG (Retrieval-Augmented Generation) system.
*   `src/utils/` - Helpers for AI, Database, and Logic.

## 🤝 Contributing
Project is maintained by the Fallout Anomaly team. Please commit changes to valid branches and run `npx eslint .` before pushing.

## 📜 License
Private Project - All Rights Reserved.