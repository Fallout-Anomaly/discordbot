# Bot Features

## Ask Channel
Users can ask questions in the designated channel, and the bot will use AI to answer them based on this documentation.

## Auto Responder ⚡
The bot monitors the Support Channel for common issues. If it detects specific keywords, it will instantly reply with a pre-written fix (skipping the AI generation).

**Triggers**:
- Requires **2+ keyword matches** (e.g., "screen" + "corner") OR a specific unique phrase.
- Defined in `src/data/autoTriggers.json`.

## Commands
- Prefix: defined in config (default `!`)
- Slice command support
- `/ask <query>`: Ask the AI a question from any channel.
- `/daily`: Claim daily rewards (Caps + Items).
- `/scavenge`: Go on a scavenging run.
- `/shop`: Buy items and gear.
