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
    console.error('[SIGNATURE] Invalid signature received.');
    return c.text('Bad request signature', 401);
  }

  return next();
});

app.get('/', (c) => c.text('Anomaly Worker is active. Build: v3.2-debug'));

app.post('/', async (c) => {
  const interaction = await c.req.json();
  console.log(`[CORE] Interaction Type: ${interaction.type}`);

  if (interaction.type === InteractionType.PING) {
    return c.json({ type: InteractionResponseType.PONG });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const { name, id } = interaction.data;
    console.log(`[CORE] Command: /${name} (${id})`);

    // Verification of environment variables
    const checkSecrets = () => {
        const required = ['DISCORD_TOKEN', 'DISCORD_PUBLIC_KEY', 'GROQ_API_KEY', 'DISCORD_APP_ID'];
        for (const s of required) {
            if (!c.env[s]) {
                console.error(`[FATAL] Missing Secret: ${s}`);
                return false;
            }
        }
        return true;
    };

    if (name === PING_COMMAND.name) {
      return c.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: '🏓 Pong! (Build v3.2)' },
      });
    }

    if (name === HELP_COMMAND.name) {
      return c.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "### ☢️ Anomaly Support\n- `/ask` - AI Search\n- `/report` - Staff Alert\n- `/ping` - Status"
        }
      });
    }

    if (name === REPORT_COMMAND.name) {
      const user = interaction.data.options.find(o => o.name === 'user')?.value;
      const reason = interaction.data.options.find(o => o.name === 'reason')?.value;
      
      c.executionCtx.waitUntil((async () => {
          try {
              const res = await fetch(`https://discord.com/api/v10/channels/${c.env.REPORT_CHANNEL_ID}/messages`, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bot ${c.env.DISCORD_TOKEN}`
                  },
                  body: JSON.stringify({
                      content: `🚨 **NEW REPORT** 🚨\n\n**Reporter:** <@${interaction.member.user.id}>\n**Reported User:** <@${user}>\n**Reason:** ${reason}\n\n<@&${c.env.STAFF_ROLE_ID}>` 
                  }),
              });
              console.log(`[REPORT] Status: ${res.status}`);
          } catch (e) {
              console.error(`[REPORT] Error: ${e.message}`);
          }
      })());

      return c.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: '✅ Report sent.', flags: InteractionResponseFlags.EPHEMERAL },
      });
    }

    if (name === ASK_COMMAND.name) {
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
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      });
    }
  }

  return c.text('Unknown type', 400);
});

export default app;
