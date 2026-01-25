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
