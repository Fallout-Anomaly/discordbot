/**
 * Static definition of commands for registration and handling.
 */

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
      type: 6, // USER
      required: true,
    },
    {
      name: 'reason',
      description: 'Reason for the report',
      type: 3, // STRING
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
      type: 3, // STRING
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
      type: 6, // USER
      required: true,
    },
    {
      name: 'reason',
      description: 'Reason for the kick',
      type: 3, // STRING
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
      type: 6, // USER
      required: true,
    },
    {
      name: 'reason',
      description: 'Reason for the ban',
      type: 3, // STRING
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
      type: 6, // USER
      required: true,
    },
    {
      name: 'duration',
      description: 'Duration in minutes',
      type: 4, // INTEGER
      required: true,
    },
    {
      name: 'reason',
      description: 'Reason for the timeout',
      type: 3, // STRING
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
      type: 4, // INTEGER
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
      type: 3, // STRING
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
      type: 6, // USER
      required: true,
    },
    {
      name: 'nickname',
      description: 'The new nickname',
      type: 3, // STRING
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
      type: 6, // USER
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
      type: 6, // USER
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
      type: 6, // USER
      required: false,
    }
  ]
};
