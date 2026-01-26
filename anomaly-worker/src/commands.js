/**
 * Static definition of commands for registration and handling.
 */

export const OptionType = {
  SUB_COMMAND: 1,
  SUB_COMMAND_GROUP: 2,
  STRING: 3,
  INTEGER: 4,
  BOOLEAN: 5,
  USER: 6,
  CHANNEL: 7,
  ROLE: 8,
  MENTIONABLE: 9,
  NUMBER: 10,
  ATTACHMENT: 11,
};

export const PING_COMMAND = {
  name: 'ping',
  description: 'Check if the worker is alive.',
};

export const HELP_COMMAND = {
  name: 'help',
  description: 'Show available commands and resources.',
};

export const REPORT_COMMAND = {
  name: 'report',
  description: 'Report a user to the staff team.',
  options: [
    {
      name: 'user',
      description: 'The user to report',
      type: OptionType.USER,
      required: true,
    },
    {
      name: 'reason',
      description: 'Reason for the report',
      type: OptionType.STRING,
      required: true,
    }
  ]
};

export const ASK_COMMAND = {
  name: 'ask',
  description: 'Ask a question about the Fallout Anomaly modpack.',
  options: [
    {
      name: 'question',
      description: 'Your question (e.g. "How do I install?")',
      type: OptionType.STRING,
      required: true,
    }
  ]
};

export const KICK_COMMAND = {
  name: 'kick',
  description: 'Kick a user from the server.',
  options: [
    {
      name: 'user',
      description: 'The user to kick',
      type: OptionType.USER,
      required: true,
    },
    {
      name: 'reason',
      description: 'Reason for the kick',
      type: OptionType.STRING,
      required: false,
    }
  ]
};

export const BAN_COMMAND = {
  name: 'ban',
  description: 'Ban a user from the server.',
  options: [
    {
      name: 'user',
      description: 'The user to ban',
      type: OptionType.USER,
      required: true,
    },
    {
      name: 'reason',
      description: 'Reason for the ban',
      type: OptionType.STRING,
      required: false,
    }
  ]
};

export const TIMEOUT_COMMAND = {
  name: 'timeout',
  description: 'Put a user in timeout.',
  options: [
    {
      name: 'user',
      description: 'The user to timeout',
      type: OptionType.USER,
      required: true,
    },
    {
      name: 'duration',
      description: 'Duration in minutes',
      type: OptionType.INTEGER,
      required: true,
    },
    {
      name: 'reason',
      description: 'Reason for the timeout',
      type: OptionType.STRING,
      required: false,
    }
  ]
};

export const CLEAR_COMMAND = {
  name: 'clear',
  description: 'Purge messages from the channel.',
  options: [
    {
      name: 'amount',
      description: 'Number of messages to delete (1-100)',
      type: OptionType.INTEGER,
      required: true,
    }
  ]
};

export const LOCK_COMMAND = {
  name: 'lock',
  description: 'Lock the current channel.',
  options: [
    {
      name: 'reason',
      description: 'Reason for locking',
      type: OptionType.STRING,
      required: false,
      
    }
  ]
};

export const UNLOCK_COMMAND = {
  name: 'unlock',
  description: 'Unlock the current channel.',
};

export const SETNICK_COMMAND = {
  name: 'setnick',
  description: 'Change a user\'s nickname.',
  options: [
    {
      name: 'user',
      description: 'The user to change',
      type: OptionType.USER,
      required: true,
    },
    {
      name: 'nickname',
      description: 'The new nickname',
      type: OptionType.STRING,
      required: true,
    }
  ]
};

export const USERINFO_COMMAND = {
  name: 'userinfo',
  description: 'Display information about a user.',
  options: [
    {
      name: 'user',
      description: 'Select a user',
      type: OptionType.USER,
      required: false,
    }
  ]
};

export const AVATAR_COMMAND = {
  name: 'avatar',
  description: 'Display a user\'s avatar.',
  options: [
    {
      name: 'user',
      description: 'Select a user',
      type: OptionType.USER,
      required: false,
    }
  ]
};

export const SERVERINFO_COMMAND = {
  name: 'serverinfo',
  description: 'Display information about the server.',
};

export const BANNER_COMMAND = {
  name: 'banner',
  description: 'Display a user\'s banner.',
  options: [
    {
      name: 'user',
      description: 'Select a user',
      type: OptionType.USER,
      required: false,
    }
  ]
};

export const BF_COMMAND = {
  name: 'bf',
  description: 'Submit feedback/requests specifically for the BOT. Sent directly to dev team.',
  options: [
    {
      name: 'feedback',
      description: 'Your bot-related feedback or feature idea',
      type: OptionType.STRING,
      required: true,
    }
  ]
};

export const SETUP_VERIFY_CMD = {
  name: 'setup-verify',
  description: 'Setup the verification message with a button',
  default_member_permissions: "8", // Administrator
};

export const ADDROLE_COMMAND = {
  name: 'addrole',
  description: 'Mass assign a role to all members (moved to local bot)',
  options: [{
      name: 'role',
      description: 'Role to assign',
      type: OptionType.ROLE,
      required: true
  }]
};


