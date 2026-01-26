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
  BF_COMMAND,
  SETUP_VERIFY_CMD,
  ADDROLE_COMMAND
} from './src/commands.js';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config();

/**
 * This script registers all commands with Discord.
 * Usage: node register.js [guild|global]
 */

const token = process.env.DISCORD_TOKEN;
const applicationId = process.env.DISCORD_APP_ID;
const guildId = process.env.GUILD_ID; // Require GUILD_ID in env

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
  BF_COMMAND,
  SETUP_VERIFY_CMD,
  ADDROLE_COMMAND
];

async function registerCommands() {
  const mode = process.argv[2] || 'guild'; // Default to guild-only
  
  if (mode !== 'global' && !guildId) {
      console.error('❌ Error: GUILD_ID environment variable is required for guild registration.');
      process.exit(1);
  }

  let url = '';
  
  if (mode === 'global') {
      url = `https://discord.com/api/v10/applications/${applicationId}/commands`;
      console.log(`🌍 Registering ${commands.length} commands GLOBALLY...`);
  } else {
      console.log(`🏰 Registering ${commands.length} commands to GUILD ${guildId}...`);
      url = `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`;
  }

  try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commands),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Successfully registered ${data.length} commands.`);
        // console.log(JSON.stringify(data, null, 2));
      } else {
        const errorText = await response.text();
        console.error('❌ Error registering commands:', response.status, errorText);
      }
  } catch (error) {
     console.error('❌ Fatal Fetch Error:', error);
  }
}

registerCommands();
