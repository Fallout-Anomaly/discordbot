// Slash-command scope admin for AnomalyBot. Pure REST — no gateway connection.
// Diagnoses / fixes the "commands showing twice" problem, which happens when a
// stale GLOBAL command set coexists with the guild set we actually register via
// scripts/register-commands.js (development.enabled = true in src/config.js).
//
//   bun scripts/commands-admin.js              # read-only: list both scopes
//   bun scripts/commands-admin.js --clear-global   # wipe GLOBAL, keep guild
//
// Env (from .env, auto-loaded by Bun): CLIENT_TOKEN, DISCORD_APP_ID, GUILD_ID.
const { REST, Routes } = require('discord.js');

const token = process.env.CLIENT_TOKEN;
const appId = process.env.DISCORD_APP_ID;
const guildId = process.env.GUILD_ID;

if (!token || !appId || !guildId) {
    console.error('Missing CLIENT_TOKEN / DISCORD_APP_ID / GUILD_ID in env.');
    process.exit(1);
}

const clearGlobal = process.argv.includes('--clear-global');
const rest = new REST({ version: '10' }).setToken(token);

const names = (cmds) => cmds.length ? cmds.map((c) => c.name).sort().join(', ') : '(none)';

(async () => {
    try {
        const [global, guild] = await Promise.all([
            rest.get(Routes.applicationCommands(appId)),
            rest.get(Routes.applicationGuildCommands(appId, guildId)),
        ]);
        console.log(`GLOBAL (${global.length}): ${names(global)}`);
        console.log(`GUILD ${guildId} (${guild.length}): ${names(guild)}`);

        if (!clearGlobal) {
            if (global.length && guild.length) {
                console.log('\nBoth scopes are populated — this is the source of the doubling.');
                console.log('Run with --clear-global to remove the global copy (guild commands stay).');
            }
            return;
        }

        if (!global.length) {
            console.log('\nGlobal scope already empty — nothing to clear.');
            return;
        }
        console.log('\nClearing GLOBAL commands...');
        await rest.put(Routes.applicationCommands(appId), { body: [] });
        console.log('Done. Global commands cleared; guild commands untouched.');
        console.log('Duplicates clear from clients within a minute or two (Ctrl+R to force a refresh).');
    } catch (err) {
        const code = err?.status || err?.code;
        console.error(`Request failed${code ? ` (${code})` : ''}: ${err.message}`);
        if (code === 401) console.error('Token is stale/revoked — update CLIENT_TOKEN in .env (or run on the deploy host).');
        process.exit(1);
    }
})();
