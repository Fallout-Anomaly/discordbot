// One-shot slash-command registration (guild-scoped) for AnomalyBot.
// Pure REST — does NOT open a gateway connection. Mirrors the JSON build in
// src/client/handler/CommandsHandler.js: load every src/commands/*/*.js, keep the
// application commands (__type__ === 1), and PUT them to the dev guild.
//
//   bun scripts/register-commands.js
//
// Env (from .env, auto-loaded by Bun): CLIENT_TOKEN, DISCORD_APP_ID, GUILD_ID.
const { REST, Routes } = require('discord.js');
const { readdirSync } = require('fs');
const path = require('path');

const token = process.env.CLIENT_TOKEN;
const appId = process.env.DISCORD_APP_ID;
const guildId = process.env.GUILD_ID;

if (!token || !appId || !guildId) {
    console.error('Missing CLIENT_TOKEN / DISCORD_APP_ID / GUILD_ID in env.');
    process.exit(1);
}

const commandsDir = path.join(__dirname, '..', 'src', 'commands');
const body = [];
const names = [];

for (const dir of readdirSync(commandsDir)) {
    for (const file of readdirSync(path.join(commandsDir, dir)).filter((f) => f.endsWith('.js'))) {
        try {
            const module = require(path.join(commandsDir, dir, file));
            if (!module || module.__type__ !== 1) continue; // only application (slash) commands
            if (!module.command) { console.error('No command export in ' + file); continue; }
            const json = typeof module.command.toJSON === 'function' ? module.command.toJSON() : module.command;
            const name = json.name || module.command.name;
            if (!name) { console.error('Unnamed command in ' + file); continue; }
            body.push(json);
            names.push(name);
        } catch (e) {
            console.error('Failed to load ' + dir + '/' + file + ': ' + e.message);
        }
    }
}

(async () => {
    console.log(`Registering ${body.length} guild commands to ${guildId}:`);
    console.log('  ' + names.sort().join(', '));
    const rest = new REST({ version: '10' }).setToken(token);
    try {
        const res = await rest.put(Routes.applicationGuildCommands(appId, guildId), { body });
        console.log(`Successfully registered ${res.length} guild application commands.`);
        // Guild scope is authoritative here, so clear any GLOBAL commands — otherwise
        // they linger and the guild shows every command twice.
        await rest.put(Routes.applicationCommands(appId), { body: [] });
        console.log('Cleared global application commands to prevent duplicates.');
    } catch (err) {
        console.error('Registration failed:', err.message);
        process.exit(1);
    }
})();
