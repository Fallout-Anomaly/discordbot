import { Hono } from 'hono';
import { 
  InteractionType, 
  InteractionResponseType, 
  InteractionResponseFlags,
  verifyKey 
} from 'discord-interactions';
import { 
  PING_COMMAND, 
  HELP_COMMAND, 
  REPORT_COMMAND, 
  ASK_COMMAND 
} from './commands.js';
import { askAI } from './utils.js';

const app = new Hono();

/**
 * Middleware to verify Discord request signatures.
 */
app.use('*', async (c, next) => {
  if (c.req.method !== 'POST') return next();

  const signature = c.req.header('x-signature-ed25519');
  const timestamp = c.req.header('x-signature-timestamp');
  const body = await c.req.raw.clone().arrayBuffer();

  const isValidRequest = await verifyKey(
    body,
    signature,
    timestamp,
    c.env.DISCORD_PUBLIC_KEY
  );

  if (!isValidRequest) {
    return c.text('Bad request signature', 401);
  }

  return next();
});

app.get('/', (c) => c.text('Fallout Anomaly Support Bot (Cloudflare Worker) is active.'));

app.post('/', async (c) => {
  const interaction = await c.req.json();

  // 1. Handle PING (Mandatory for Discord interactions)
  if (interaction.type === InteractionType.PING) {
    return c.json({
      type: InteractionResponseType.PONG,
    });
  }

  // 2. Handle Slash Commands
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const { name } = interaction.data;

    switch (name) {
      case PING_COMMAND.name:
        return c.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: '🏓 Pong! Bot is running on Cloudflare Edge.' },
        });

      case HELP_COMMAND.name:
        return c.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "### ☢️ Anomaly Support Commands\n- `/ask [question]` - Get immediate AI help from the guides.\n- `/report [user] [reason]` - Notify staff of a player issue.\n- `/ping` - Check bot status.\n\n[Official Website](https://fallout-anomaly.github.io/websitedev/index.html)"
          }
        });

      case REPORT_COMMAND.name: {
        const user = interaction.data.options.find(o => o.name === 'user')?.value;
        const reason = interaction.data.options.find(o => o.name === 'reason')?.value;
        const reporterId = interaction.member.user.id;

        // Background task to send report notification
        c.executionCtx.waitUntil((async () => {
          await fetch(`https://discord.com/api/v10/channels/${c.env.REPORT_CHANNEL_ID}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bot ${c.env.DISCORD_TOKEN}`
            },
            body: JSON.stringify({
               content: `🚨 **NEW REPORT** 🚨\n\n**Reporter:** <@${reporterId}>\n**Reported User:** <@${user}>\n**Reason:** ${reason}\n\n<@&${c.env.STAFF_ROLE_ID}>` 
            }),
          });
        })());

        return c.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { 
            content: '✅ Your report has been submitted to the staff team. Thank you.',
            flags: InteractionResponseFlags.EPHEMERAL
          },
        });
      }

      case ASK_COMMAND.name: {
        const question = interaction.data.options.find(o => o.name === 'question')?.value;
        console.log(`[ASK] Question: ${question}`);

        // Defer response to allow time for AI generation
        c.executionCtx.waitUntil((async () => {
          try {
            console.log(`[ASK] Handing off to AI...`);
            const answer = await askAI(question, c.env);
            console.log(`[ASK] AI answered. Length: ${answer.length}`);
            
            const appId = c.env.DISCORD_APP_ID;
            if (!appId) {
                console.error("[ASK] FATAL: DISCORD_APP_ID secret is missing.");
                return;
            }

            const url = `https://discord.com/api/v10/webhooks/${appId}/${interaction.token}/messages/@original`;
            console.log(`[ASK] Patching Discord: ${url}`);

            const response = await fetch(url, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: answer }),
            });

            if (!response.ok) {
                const txt = await response.text();
                console.error(`[ASK] Discord API Error: ${response.status} - ${txt}`);
            } else {
                console.log(`[ASK] Success! Message updated.`);
            }
          } catch (error) {
            console.error("[ASK] Generic Async Error:", error);
          }
        })());

        return c.json({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
          data: { flags: InteractionResponseFlags.EPHEMERAL }
        });
      }

      default:
        return c.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: 'Unknown command', flags: InteractionResponseFlags.EPHEMERAL },
        });
    }
  }

  return c.text('Unknown interaction type', 400);
});

export default app;
