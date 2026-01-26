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
  SETUP_VERIFY_CMD
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

  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
      if (interaction.data.custom_id === 'verify_member') {
          const roleId = c.env.MEMBER_ROLE_ID;
          if (!roleId) {
               return c.json({
                  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                  data: { content: '❌ Role configuration error. Contact admin.', flags: InteractionResponseFlags.EPHEMERAL }
              });
          }
          
          const guildId = interaction.guild_id;
          const userId = interaction.member.user.id;

          c.executionCtx.waitUntil((async () => {
              try {
                  await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
                      method: 'PUT',
                      headers: { 
                          'Authorization': `Bot ${c.env.DISCORD_TOKEN}`,
                          'Content-Type': 'application/json'
                      }
                  });
              } catch (e) {
                  console.error(`[VERIFY] Error: ${e.message}`);
              }
          })().catch(e => console.error(e)));

          return c.json({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { 
                  content: `✅ Verified! You have been granted the <@&${roleId}> role.`, 
                  flags: InteractionResponseFlags.EPHEMERAL 
              }
          });
      }
  }

  // Verification of environment variables
  const checkSecrets = (env) => {
    const required = ['DISCORD_TOKEN', 'DISCORD_PUBLIC_KEY', 'GROQ_API_KEY', 'DISCORD_APP_ID'];
    for (const s of required) {
        if (!env[s]) {
            console.error(`[FATAL] Missing Secret: ${s}`);
            return false;
        }
    }
    return true;
  };

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const { name, id } = interaction.data;
    console.log(`[CORE] Command: /${name} (${id})`);

    if (!checkSecrets(c.env)) {
        return c.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { 
                content: '⚠️ Fatal: Bot is missing configuration secrets. Please contact an administrator.', 
                flags: InteractionResponseFlags.EPHEMERAL 
            }
        });
    }

    if (name === PING_COMMAND.name) {
      return c.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `🏓 Pong! (Build ${c.env.WORKER_VERSION || 'v1.0-unknown'})` },
      });
    }

    if (name === HELP_COMMAND.name) {
      return c.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "### ☢️ Anomaly Support\n- `/ask` - AI Search\n- `/report` - Staff Alert\n- `/ping` - Status\n- `/kick /ban /timeout /clear` - Moderation"
        }
      });
    }

    // Helper: Patch Interaction
    const patchInteraction = async (bodyContent) => {
        const patchUrl = `https://discord.com/api/v10/webhooks/${c.env.DISCORD_APP_ID}/${interaction.token}/messages/@original`;
        const response = await fetch(patchUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyContent),
        });
        if (!response.ok) {
            throw new Error(`Failed to patch interaction: ${response.status} ${await response.text()}`);
        }
        return response;
    };

    // Logging Helper
    const logAction = async (title, color, details) => {
        const channelId = c.env.LOGS_CHANNEL_ID;
        if (!channelId) {
            console.warn('[LOG] LOGS_CHANNEL_ID not set, skipping log.');
            return;
        }

        try {
            await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bot ${c.env.DISCORD_TOKEN}`
                },
                body: JSON.stringify({
                    embeds: [{
                        title: `🛡️ Moderation Log: ${title}`,
                        color: color,
                        fields: details,
                        timestamp: new Date().toISOString()
                    }]
                }),
            });
        } catch (e) {
            console.error(`[LOG] Failed: ${e.message}`);
        }
    };

    // Permission Helper
    const hasPermission = () => {
        // Check for Administrator permission (Bit 3) using BigInt
        const permissions = BigInt(interaction.member.permissions || 0);
        if ((permissions & 8n) === 8n) return true;

        // Check if user has the STAFF_ROLE_ID
        if (c.env.STAFF_ROLE_ID && interaction.member.roles.includes(c.env.STAFF_ROLE_ID)) return true;

        return false;
    };

    if (name === KICK_COMMAND.name) {
      if (!hasPermission()) {
            return c.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ You do not have permission to use this command.', flags: InteractionResponseFlags.EPHEMERAL }
            });
      }
      const user = interaction.data.options.find(o => o.name === 'user')?.value;
      const reason = interaction.data.options.find(o => o.name === 'reason')?.value || 'No reason provided';
      const guildId = interaction.guild_id;

      c.executionCtx.waitUntil((async () => {
        try {
          const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${user}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bot ${c.env.DISCORD_TOKEN}`, 'X-Audit-Log-Reason': reason }
          });

          const patchUrl = `https://discord.com/api/v10/webhooks/${c.env.DISCORD_APP_ID}/${interaction.token}/messages/@original`;
          
          if (res.ok) {
            await patchInteraction({ 
                content: `✅ Successfully kicked <@${user}>.`,
                flags: InteractionResponseFlags.EPHEMERAL
            });

            // We do NOT send ephemeral flag here because the deferred response was ephemeral,
            // so this patch will update that ephemeral message.

            await logAction('User Kicked', 0xffa500, [
                { name: 'Target', value: `<@${user}>`, inline: true },
                { name: 'Moderator', value: `<@${interaction.member.user.id}>`, inline: true },
                { name: 'Reason', value: reason }
            ]);
          } else {
            const err = await res.text();
            console.error(`[KICK] Failed: ${err}`);
            await patchInteraction({ 
                content: `❌ Failed to kick <@${user}>. (Likely hierarchy or permission issue)`,
                flags: InteractionResponseFlags.EPHEMERAL
            });
          }
        } catch (e) {
          console.error(`[KICK] Async Error: ${e.message}`);
        }
      })().catch(e => console.error(e)));

      return c.json({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: { flags: InteractionResponseFlags.EPHEMERAL }
      });
    }

    if (name === BAN_COMMAND.name) {
      if (!hasPermission()) {
            return c.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ You do not have permission to use this command.', flags: InteractionResponseFlags.EPHEMERAL }
            });
      }
      const user = interaction.data.options.find(o => o.name === 'user')?.value;
      const reason = interaction.data.options.find(o => o.name === 'reason')?.value || 'No reason provided';
      const guildId = interaction.guild_id;

      c.executionCtx.waitUntil((async () => {
        try {
          const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/bans/${user}`, {
            method: 'PUT',
            headers: { 
              'Authorization': `Bot ${c.env.DISCORD_TOKEN}`, 
              'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ reason })
          });

          const patchUrl = `https://discord.com/api/v10/webhooks/${c.env.DISCORD_APP_ID}/${interaction.token}/messages/@original`;

          if (res.ok) {
            await patchInteraction({ 
                content: `🔨 Successfully banned <@${user}>.`,
                flags: InteractionResponseFlags.EPHEMERAL
            });

            await logAction('User Banned', 0xff0000, [
                { name: 'Target', value: `<@${user}>`, inline: true },
                { name: 'Moderator', value: `<@${interaction.member.user.id}>`, inline: true },
                { name: 'Reason', value: reason }
            ]);
          } else {
            const err = await res.text();
            console.error(`[BAN] Failed: ${err}`);
            await patchInteraction({ 
                content: `❌ Failed to ban <@${user}>. (Likely hierarchy or permission issue)`,
                flags: InteractionResponseFlags.EPHEMERAL
            });
          }
        } catch (e) {
          console.error(`[BAN] Async Error: ${e.message}`);
        }
      })().catch(e => console.error(e)));

      return c.json({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: { flags: InteractionResponseFlags.EPHEMERAL }
      });
    }

    if (name === TIMEOUT_COMMAND.name) {
      if (!hasPermission()) {
            return c.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ You do not have permission to use this command.', flags: InteractionResponseFlags.EPHEMERAL }
            });
      }
      const user = interaction.data.options.find(o => o.name === 'user')?.value;
      const duration = interaction.data.options.find(o => o.name === 'duration')?.value;
      const reason = interaction.data.options.find(o => o.name === 'reason')?.value || 'No reason provided';
      const guildId = interaction.guild_id;
      const until = new Date(Date.now() + duration * 60000).toISOString();

      c.executionCtx.waitUntil((async () => {
        try {
          const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${user}`, {
            method: 'PATCH',
            headers: { 
              'Authorization': `Bot ${c.env.DISCORD_TOKEN}`, 
              'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ communication_disabled_until: until, reason })
          });

          const patchUrl = `https://discord.com/api/v10/webhooks/${c.env.DISCORD_APP_ID}/${interaction.token}/messages/@original`;

          if (res.ok) {
            await patchInteraction({ 
                content: `⏳ Timed out <@${user}> for ${duration}m.`,
                flags: InteractionResponseFlags.EPHEMERAL
            });

            await logAction('User Timed Out', 0xffff00, [
                { name: 'Target', value: `<@${user}>`, inline: true },
                { name: 'Moderator', value: `<@${interaction.member.user.id}>`, inline: true },
                { name: 'Duration', value: `${duration}m`, inline: true },
                { name: 'Reason', value: reason }
            ]);
          } else {
            const err = await res.text();
            console.error(`[TIMEOUT] Failed: ${err}`);
             await patchInteraction({ 
                content: `❌ Failed to timeout <@${user}>. (Likely hierarchy or permission issue)`,
                flags: InteractionResponseFlags.EPHEMERAL
            });
          }
        } catch (e) {
          console.error(`[TIMEOUT] Async Error: ${e.message}`);
        }
      })().catch(e => console.error(e)));

      return c.json({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: { flags: InteractionResponseFlags.EPHEMERAL }
      });
    }

    if (name === CLEAR_COMMAND.name) {
      if (!hasPermission()) {
            return c.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ You do not have permission to use this command.', flags: InteractionResponseFlags.EPHEMERAL }
            });
      }
      const amount = interaction.data.options.find(o => o.name === 'amount')?.value;
      const channelId = interaction.channel_id;

      c.executionCtx.waitUntil((async () => {
        try {
          const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=${amount}`, {
            headers: { 'Authorization': `Bot ${c.env.DISCORD_TOKEN}` }
          });
          const messages = await msgRes.json();
          const ids = messages.map(m => m.id);

          const patchUrl = `https://discord.com/api/v10/webhooks/${c.env.DISCORD_APP_ID}/${interaction.token}/messages/@original`;

            // Filter out messages older than 14 days (Discord API Limitation for Bulk Delete)
            const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000); // 14 Days in ms
            const validIds = messages.filter(m => {
                const timestamp = Number((BigInt(m.id) >> 22n) + 1420070400000n);
                return timestamp > twoWeeksAgo;
            }).map(m => m.id);

            if (validIds.length > 0) {
              const bulkRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/bulk-delete`, {
                method: 'POST',
                headers: { 
                  'Authorization': `Bot ${c.env.DISCORD_TOKEN}`, 
                  'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ messages: validIds })
              });

              if (bulkRes.ok) {
                await patchInteraction({ 
                    content: `🧹 Successfully cleared ${validIds.length} messages. (${ids.length - validIds.length} were too old to delete)`,
                    flags: InteractionResponseFlags.EPHEMERAL
                });

                await logAction('Messages Purged', 0x00ff00, [
                    { name: 'Channel', value: `<#${channelId}>`, inline: true },
                    { name: 'Moderator', value: `<@${interaction.member.user.id}>`, inline: true },
                    { name: 'Amount', value: `${validIds.length}`, inline: true }
                ]);
              } else {
              await patchInteraction({ 
                  content: `❌ Failed to purge messages. (Likely too old or permission issue)`,
                  flags: InteractionResponseFlags.EPHEMERAL
              });
            }
          } else {
            await patchInteraction({ content: `🧹 No messages found to clear.` });
          }
        } catch (e) {
          console.error(`[CLEAR] Async Error: ${e.message}`);
        }
      })().catch(e => console.error(e)));

      return c.json({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: { flags: InteractionResponseFlags.EPHEMERAL }
      });
    }

    if (name === LOCK_COMMAND.name) {
        if (!hasPermission()) {
            return c.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ You do not have permission to use this command.', flags: InteractionResponseFlags.EPHEMERAL }
            });
        }
        const reason = interaction.data.options?.find(o => o.name === 'reason')?.value || 'No reason provided';
        const channelId = interaction.channel_id;
        const guildId = interaction.guild_id;

        c.executionCtx.waitUntil((async () => {
            try {
                // Get everyone role ID (guildId is the everyone role ID)
                const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/permissions/${guildId}`, {
                    method: 'PUT',
                    headers: { 
                      'Authorization': `Bot ${c.env.DISCORD_TOKEN}`, 
                      'Content-Type': 'application/json',
                      'X-Audit-Log-Reason': reason
                    },
                    body: JSON.stringify({
                        deny: "2048", // SEND_MESSAGES
                        type: 0 // Role
                    })
                });

                const patchUrl = `https://discord.com/api/v10/webhooks/${c.env.DISCORD_APP_ID}/${interaction.token}/messages/@original`;

                if (res.ok) {
                    await patchInteraction({ 
                        content: `🔒 Channel locked. Reason: ${reason}`,
                        flags: InteractionResponseFlags.EPHEMERAL
                    });
                    await logAction('Channel Locked', 0xff0000, [
                        { name: 'Channel', value: `<#${channelId}>`, inline: true },
                        { name: 'Moderator', value: `<@${interaction.member.user.id}>`, inline: true }
                    ]);
                } else {
                    await patchInteraction({ 
                        content: `❌ Failed to lock channel.`,
                        flags: InteractionResponseFlags.EPHEMERAL
                    });
                }
            } catch (e) {
                console.error(`[LOCK] Async Error: ${e.message}`);
                await patchInteraction({ 
                    content: `❌ An internal error occurred while locking channel.`,
                    flags: InteractionResponseFlags.EPHEMERAL
                });
            }
        })().catch(e => console.error(e)));

        return c.json({
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
            data: { flags: InteractionResponseFlags.EPHEMERAL }
        });
    }

    if (name === UNLOCK_COMMAND.name) {
        if (!hasPermission()) {
            return c.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ You do not have permission to use this command.', flags: InteractionResponseFlags.EPHEMERAL }
            });
        }
        const channelId = interaction.channel_id;
        const guildId = interaction.guild_id;

        c.executionCtx.waitUntil((async () => {
            try {
                const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/permissions/${guildId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bot ${c.env.DISCORD_TOKEN}` }
                });

                const patchUrl = `https://discord.com/api/v10/webhooks/${c.env.DISCORD_APP_ID}/${interaction.token}/messages/@original`;

                if (res.ok) {
                    await patchInteraction({ 
                        content: `🔓 Channel unlocked.`,
                        flags: InteractionResponseFlags.EPHEMERAL
                    });
                    await logAction('Channel Unlocked', 0x00ff00, [
                        { name: 'Channel', value: `<#${channelId}>`, inline: true },
                        { name: 'Moderator', value: `<@${interaction.member.user.id}>`, inline: true }
                    ]);
                } else {
                    await patchInteraction({ 
                        content: `❌ Failed to unlock channel.`,
                        flags: InteractionResponseFlags.EPHEMERAL
                    });
                }
            } catch (e) {
                console.error(`[UNLOCK] Async Error: ${e.message}`);
                await patchInteraction({ 
                    content: `❌ An internal error occurred while unlocking channel.`,
                    flags: InteractionResponseFlags.EPHEMERAL
                });
            }
        })().catch(e => console.error(e)));

        return c.json({
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
            data: { flags: InteractionResponseFlags.EPHEMERAL }
        });
    }

    if (name === SETNICK_COMMAND.name) {
        if (!hasPermission()) {
            return c.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ You do not have permission to use this command.', flags: InteractionResponseFlags.EPHEMERAL }
            });
        }
        const user = interaction.data.options.find(o => o.name === 'user')?.value;
        const nickname = interaction.data.options.find(o => o.name === 'nickname')?.value;
        const guildId = interaction.guild_id;

        c.executionCtx.waitUntil((async () => {
            try {
                const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${user}`, {
                    method: 'PATCH',
                    headers: { 
                      'Authorization': `Bot ${c.env.DISCORD_TOKEN}`, 
                      'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({ nick: nickname })
                });

                const patchUrl = `https://discord.com/api/v10/webhooks/${c.env.DISCORD_APP_ID}/${interaction.token}/messages/@original`;

                if (res.ok) {
                    await patchInteraction({ 
                        content: `✅ Substituted nickname for <@${user}> to **${nickname}**.`,
                        flags: InteractionResponseFlags.EPHEMERAL
                    });
                    await logAction('Nickname Changed', 0x3498db, [
                        { name: 'Target', value: `<@${user}>`, inline: true },
                        { name: 'New Nick', value: nickname, inline: true },
                        { name: 'Moderator', value: `<@${interaction.member.user.id}>`, inline: true }
                    ]);
                } else {
                    await patchInteraction({ 
                        content: `❌ Failed to change nickname. (Likely hierarchy issue)`,
                        flags: InteractionResponseFlags.EPHEMERAL
                    });
                }
            } catch (e) {
                console.error(`[SETNICK] Async Error: ${e.message}`);
                await patchInteraction({ 
                    content: `❌ An internal error occurred while changing nickname.`,
                    flags: InteractionResponseFlags.EPHEMERAL
                });
            }
        })().catch(e => console.error(e)));

        return c.json({
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
            data: { flags: InteractionResponseFlags.EPHEMERAL }
        });
    }

    if (name === USERINFO_COMMAND.name) {
        const targetId = interaction.data.options?.find(o => o.name === 'user')?.value || interaction.member.user.id;
        const guildId = interaction.guild_id;

        c.executionCtx.waitUntil((async () => {
            try {
                const memberRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${targetId}`, {
                    headers: { 'Authorization': `Bot ${c.env.DISCORD_TOKEN}` }
                });
                const member = await memberRes.json();
                const user = member.user;

                // Snowflake to Timestamp
                const getCreationDate = (id) => Math.floor((Number(BigInt(id) >> BigInt(22)) + 1420070400000) / 1000);
                const creationDate = getCreationDate(user.id);
                const joinDate = Math.floor(new Date(member.joined_at).getTime() / 1000);

                const patchUrl = `https://discord.com/api/v10/webhooks/${c.env.DISCORD_APP_ID}/${interaction.token}/messages/@original`;

                await patchInteraction({
                    embeds: [{
                        title: `User Information: ${user.username}`,
                        thumbnail: { url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` },
                        color: 0x3498db,
                        fields: [
                            { name: 'Tag', value: `${user.username}#${user.discriminator}`, inline: true },
                            { name: 'ID', value: user.id, inline: true },
                            { name: 'Created', value: `<t:${creationDate}:R>`, inline: true },
                            { name: 'Joined', value: `<t:${joinDate}:R>`, inline: true },
                            { name: 'Roles', value: member.roles.map(r => `<@&${r}>`).join(' ') || 'None' }
                        ]
                    }]
                });
            } catch (e) {
                console.error(`[USERINFO] Async Error: ${e.message}`);
                await patchInteraction({ 
                    content: `❌ Failed to fetch user information.`,
                    flags: InteractionResponseFlags.EPHEMERAL
                });
            }
        })().catch(e => console.error(e)));

        return c.json({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
    }

    if (name === AVATAR_COMMAND.name) {
        const targetId = interaction.data.options?.find(o => o.name === 'user')?.value || interaction.member.user.id;
        const user = interaction.data.resolved?.users?.[targetId] || interaction.member.user;

        return c.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                embeds: [{
                    title: `${user.username}'s Avatar`,
                    image: { url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar?.startsWith('a_') ? 'gif' : 'png'}?size=1024` },
                    color: 0x3498db
                }]
            }
        });
    }

    if (name === SERVERINFO_COMMAND.name) {
        const guildId = interaction.guild_id;

        c.executionCtx.waitUntil((async () => {
            try {
                const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, {
                    headers: { 'Authorization': `Bot ${c.env.DISCORD_TOKEN}` }
                });
                const guild = await guildRes.json();
                const creationDate = Math.floor((Number(BigInt(guildId) >> BigInt(22)) + 1420070400000) / 1000);

                const patchUrl = `https://discord.com/api/v10/webhooks/${c.env.DISCORD_APP_ID}/${interaction.token}/messages/@original`;

                await patchInteraction({
                    embeds: [{
                        title: `Server Information: ${guild.name}`,
                        thumbnail: { url: `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` },
                        color: 0x3498db,
                        fields: [
                            { name: 'Owner ID', value: guild.owner_id, inline: true },
                            { name: 'Members', value: `${guild.approximate_member_count}`, inline: true },
                            { name: 'Created', value: `<t:${creationDate}:R>`, inline: true },
                            { name: 'Boosts', value: `${guild.premium_subscription_count || 0} (Level ${guild.premium_tier})`, inline: true }
                        ]
                    }]
                });
            } catch (e) {
                console.error(`[SERVERINFO] Async Error: ${e.message}`);
                await patchInteraction({ 
                    content: `❌ Failed to fetch server information.`,
                    flags: InteractionResponseFlags.EPHEMERAL
                });
            }
        })().catch(e => console.error(e)));

        return c.json({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
    }

    if (name === BANNER_COMMAND.name) {
        const targetId = interaction.data.options?.find(o => o.name === 'user')?.value || interaction.member.user.id;
        
        c.executionCtx.waitUntil((async () => {
            try {
                const userRes = await fetch(`https://discord.com/api/v10/users/${targetId}`, {
                    headers: { 'Authorization': `Bot ${c.env.DISCORD_TOKEN}` }
                });
                const user = await userRes.json();

                const patchUrl = `https://discord.com/api/v10/webhooks/${c.env.DISCORD_APP_ID}/${interaction.token}/messages/@original`;

                if (user.banner) {
                    await patchInteraction({
                        embeds: [{
                            title: `${user.username}'s Banner`,
                            image: { url: `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.${user.banner?.startsWith('a_') ? 'gif' : 'png'}?size=1024` },
                            color: 0x3498db
                        }]
                    });
                } else {
                    await patchInteraction({ content: `❌ This user does not have a banner.` });
                }
            } catch (e) {
                console.error(`[BANNER] Async Error: ${e.message}`);
                await patchInteraction({ 
                     content: `❌ Failed to fetch banner.`,
                     flags: InteractionResponseFlags.EPHEMERAL
                });
            }
        })().catch(e => console.error(e)));

        return c.json({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
    }

    if (name === BF_COMMAND.name) {
        const feedback = interaction.data.options.find(o => o.name === 'feedback')?.value;
        const guildId = interaction.guild_id;

        c.executionCtx.waitUntil((async () => {
            try {
                // Determine channel to send feedback to (use BOT_FEEDBACK_CHANNEL_ID or REPORT_CHANNEL_ID as fallback)
                const targetChannel = c.env.BOT_FEEDBACK_CHANNEL_ID || c.env.REPORT_CHANNEL_ID;
                if (!targetChannel) return;

                const res = await fetch(`https://discord.com/api/v10/channels/${targetChannel}/messages`, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bot ${c.env.DISCORD_TOKEN}`
                  },
                  body: JSON.stringify({
                      embeds: [{
                          title: '💡 Bot Feedback / Request',
                          color: 0x9b59b6, // Purple
                          fields: [
                              { name: 'User', value: `<@${interaction.member.user.id}>` },
                              { name: 'Feedback', value: feedback }
                          ],
                          timestamp: new Date().toISOString()
                      }]
                  }),
                });
            } catch (e) {
                console.error(`[BF] Error: ${e.message}`);
            }
        })().catch(e => console.error(e)));

        return c.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { 
                content: 'Thank you for your feedback! We will review it shortly. - Anomaly Team', 
                flags: InteractionResponseFlags.EPHEMERAL 
            },
        });
    }

    if (name === 'setup-verify') {
        try {
            // Only allow administrators
            const permissions = interaction.member?.permissions;
            if (!permissions) {
                 return c.json({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { content: '❌ Could not determine permissions.', flags: InteractionResponseFlags.EPHEMERAL },
                });
            }

            const hasAdmin = (BigInt(permissions) & BigInt(8)) === BigInt(8);
            if (!hasAdmin) {
                 return c.json({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { content: '❌ You need Admin permissions to use this.', flags: InteractionResponseFlags.EPHEMERAL },
                });
            }

            return c.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    embeds: [{
                        title: '🛡️ Survivor Verification',
                        description: 'To gain access to the rest of the server, please confirm that you have read and understood our rules and guidelines.\n\nBy clicking the button below, you agree to follow the community standards.',
                        color: 0x3498db,
                        footer: { text: 'Anomaly Verification System' }
                    }],
                    components: [{
                        type: 1, // Action Row
                        components: [{
                            type: 2, // Button
                            style: 3, // Success (Green)
                            label: 'Confirm & Verify',
                            emoji: { name: '✅' },
                            custom_id: 'verify_member'
                        }]
                    }]
                }
            });
        } catch (e) {
             console.error(`[SETUP] Error: ${e.message}`);
             return c.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ An error occurred.', flags: InteractionResponseFlags.EPHEMERAL },
            });
        }
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
      })().catch(e => console.error(e)));

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
      })().catch(e => console.error(e)));

      return c.json({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      });
    }




  }

  return c.text('Unknown type', 400);
});



export default app;
