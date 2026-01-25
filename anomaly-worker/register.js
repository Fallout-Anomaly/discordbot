import { 
  PING_COMMAND, 
  HELP_COMMAND, 
  REPORT_COMMAND, 
  ASK_COMMAND,
  KICK_COMMAND,
  BAN_COMMAND,
  TIMEOUT_COMMAND,
  CLEAR_COMMAND,
  LOCK_COMMAND,
  UNLOCK_COMMAND,
  SETNICK_COMMAND,
  USERINFO_COMMAND,
  AVATAR_COMMAND,
  SERVERINFO_COMMAND,
  BANNER_COMMAND,
  BF_COMMAND
} from './src/commands.js';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config();

/**
 * This script registers all commands with Discord.
 * It uses the DISCORD_TOKEN and DISCORD_APP_ID from your .env file or environment.
 */

const token = process.env.DISCORD_TOKEN;
const applicationId = process.env.DISCORD_APP_ID;
const guildId = '1113971680419782666'; // Target server

if (!token || !applicationId) {
  throw new Error('The DISCORD_TOKEN and DISCORD_APP_ID environment variables are required.');
}

const commands = [
  PING_COMMAND,
  HELP_COMMAND,
  REPORT_COMMAND,
  ASK_COMMAND,
  KICK_COMMAND,
  BAN_COMMAND,
  TIMEOUT_COMMAND,
  CLEAR_COMMAND,
  LOCK_COMMAND,
  UNLOCK_COMMAND,
  SETNICK_COMMAND,
  USERINFO_COMMAND,
  AVATAR_COMMAND,
  SERVERINFO_COMMAND,
  BANNER_COMMAND,
  BF_COMMAND
];

async function registerGuildCommands() {
  const url = `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`;
  
  console.log(`Registering ${commands.length} commands to guild ${guildId}...`);

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });

  if (response.ok) {
    console.log('Successfully registered guild commands.');
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } else {
    const error = await response.text();
    console.error('Error registering commands:', error);
  }
}

registerGuildCommands();
