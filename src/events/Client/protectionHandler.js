const { Events, EmbedBuilder } = require('discord.js');
const Event = require('../../structure/Event');

// Cache for spam detection
const messageHistory = new Map();
const SPAM_THRESHOLD = parseInt(process.env.SPAM_THRESHOLD) || 5; // messages
const SPAM_INTERVAL = parseInt(process.env.SPAM_INTERVAL) || 5000; // ms
const SPAM_TIMEOUT_DURATION = parseInt(process.env.SPAM_TIMEOUT_DURATION) || 600000; // 10 mins

// Cleanup interval to prevent memory leaks (runs every 5 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [userId, messages] of messageHistory.entries()) {
        const validMessages = messages.filter(msg => now - msg.timestamp < SPAM_INTERVAL);
        if (validMessages.length === 0) {
            messageHistory.delete(userId);
        } else {
            messageHistory.set(userId, validMessages);
        }
    }
}, 5 * 60 * 1000);

// Blacklist Cache & Loader
const fs = require('fs').promises;
const path = require('path');
let blacklistCache = null;
let blacklistLoading = false;

const loadBlacklist = async () => {
    if (blacklistLoading) return; // Already loading, don't re-enter
    if (blacklistCache !== null) return; // Already loaded, skip
    
    blacklistLoading = true;
    try {
        const blacklistPath = path.join(__dirname, '../../utils/uBlacklist.txt');
        // Check existence first? fs.promises doesn't have exists, use access or try/catch
        try {
            const content = await fs.readFile(blacklistPath, 'utf-8');
            blacklistCache = content.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#') && !line.startsWith('---') && !line.startsWith('name:') && !line.startsWith('description:') && !line.startsWith('homepage:'))
                .map(line => {
                    let pattern = line.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
                    pattern = pattern.replace(/\*/g, '.*');
                    return new RegExp(pattern, 'i');
                });
            console.log(`[PROTECTION] Async loaded ${blacklistCache.length} domains from uBlacklist.txt`);
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.warn('[PROTECTION] uBlacklist.txt not found. Link filtering disabled.');
                blacklistCache = [];
            } else {
                throw err;
            }
        }
    } catch (e) {
        console.error('[PROTECTION] Failed to load blacklist (Async):', e);
        blacklistCache = []; // Default to empty to prevent loops
    } finally {
        blacklistLoading = false;
    }
};

// Start loading immediately
loadBlacklist();

module.exports = new Event({
    event: Events.MessageCreate,
    once: false,
    run: async (client, message) => {
        if (message.author.bot || !message.guild) return;

        // Ensure blacklist is loaded (if it failed initially or wasn't ready, we check again or wait)
        if (blacklistCache === null) {
            // Wait for blacklist to load with a small timeout to prevent hanging
            const startTime = Date.now();
            while (blacklistLoading && Date.now() - startTime < 3000) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            // If still not loaded after wait, load it now
            if (blacklistCache === null) {
                await loadBlacklist();
            }
        }
        
        // Treat empty cache as "pass"
        const effectiveBlacklist = blacklistCache || [];

        // Bypass for staff
        const staffRoleId = process.env.STAFF_ROLE_ID;
        if (staffRoleId && message.member.roles.cache.has(staffRoleId)) return;

        const logChannelId = process.env.LOGS_CHANNEL_ID;
        const logChannel = client.channels.cache.get(logChannelId);

        // 1. Link Protection (Blacklist)
        const isBlacklisted = effectiveBlacklist.some(regex => regex.test(message.content));

        if (isBlacklisted) {
            try {
                // Permission Check before deletion
                const canManage = message.channel.permissionsFor(client.user)?.has('ManageMessages');
                
                if (canManage) {
                    await message.delete().catch(e => console.error(`[PROTECTION] Failed to delete message: ${e.message}`));
                }

                // Only send warning if we have permission
                if (message.channel.permissionsFor(client.user)?.has('SendMessages')) {
                    const warningMessage = `<@${message.author.id}>, that link is not allowed here.`;
                    const warning = await message.channel.send(warningMessage);
                    setTimeout(() => warning.delete().catch(() => {}), 5000);
                }

                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🛡️ Malicious Link Blocked')
                        .setColor('#ff0000')
                        .addFields(
                            { name: 'User', value: `${message.author.tag} (${message.author.id})` },
                            { name: 'Channel', value: `<#${message.channel.id}>` },
                            { name: 'Blocked Content', value: message.content.substring(0, 1024) }
                        )
                        .setTimestamp();
                    logChannel.send({ embeds: [embed] });
                }
                return; // Stop further checks if deleted
            } catch (e) {
                console.error("[PROTECTION] Link delete logic failed:", e.message);
            }
        }

        // 2. Anti-Spam
        // Check if already timed out to prevent "ghost" processing
        if (message.member.communicationDisabledUntilTimestamp && message.member.communicationDisabledUntilTimestamp > Date.now()) return;

        const now = Date.now();
        const userData = messageHistory.get(message.author.id) || [];
        
        // Filter out old messages
        const recentMessages = userData.filter(msg => now - msg.timestamp < SPAM_INTERVAL);
        
        // Add new message (limit content length for memory safety)
        const contentSnapshot = message.content.substring(0, 100);
        recentMessages.push({ timestamp: now, content: contentSnapshot });
        messageHistory.set(message.author.id, recentMessages);

        // Analysis
        const count = recentMessages.length;
        const duplicates = recentMessages.filter(msg => msg.content === contentSnapshot).length;

        // Custom Strict Thresholds 
        const DUPLICATE_THRESHOLD = 3;

        if (count > SPAM_THRESHOLD || duplicates >= DUPLICATE_THRESHOLD) {
            try {
                // Check if user can be timed out
                if (!message.member.moderatable) {
                    // Still delete if possible, but skip timeout
                    return;
                }

                const reason = duplicates >= DUPLICATE_THRESHOLD ? "Spamming Duplicate Content" : "Automated Anti-Spam (Rate Limit)";

                // Timeout user
                await message.member.timeout(SPAM_TIMEOUT_DURATION, reason);
                await message.channel.send(`⚠️ <@${message.author.id}> has been timed out for spamming.`);

                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🛡️ Spam Detected')
                        .setColor('#ffaa00')
                        .addFields(
                            { name: 'User', value: `${message.author.tag} (${message.author.id})` },
                            { name: 'Reason', value: reason },
                            { name: 'Action', value: `${Math.floor(SPAM_TIMEOUT_DURATION / 60000)} Minute Timeout` }
                        )
                        .setTimestamp();
                    logChannel.send({ embeds: [embed] });
                }
                // Clear history to prevent double trigger
                messageHistory.delete(message.author.id);
            } catch (e) {
                console.error("[PROTECTION] Spam timeout failed:", e.message);
            }
        }
    }
}).toJSON();
