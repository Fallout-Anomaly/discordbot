const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.CLIENT_TOKEN);

(async () => {
    try {
        console.log('Started clearing application commands.');

        // Get the bot ID first
        const user = await rest.get(Routes.user());
        const clientId = user.id;

        // Clear global commands
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        console.log('Successfully cleared global application commands.');

        // Clear guild commands for the specific guild
        const guildId = '1113971680419782666';
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
        console.log('Successfully cleared guild application commands.');

    } catch (error) {
        console.error(error);
    }
})();
