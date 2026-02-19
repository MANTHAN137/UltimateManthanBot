/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║        MANTHAN AI — ULTIMATE OMNI BOT v4.1 FINAL            ║
 * ║  Multi-Brain | EQ | Voice | Search | YouTube | Instagram    ║
 * ║  Summarizer  | A/B Testing | Human-Like | Persistent        ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Architecture:
 * 
 *   Message → Trigger Check → Intent+Emotion NLP → Memory Fetch
 *       → Summarizer (compress if long) → Router Brain
 *       → Chat/Knowledge/Social/Search/YouTube Brain
 *       → Safety Filter → Humanizer → Voice (optional) → Send
 *       → A/B Testing (track engagement)
 * 
 * Author: Manthan Dhole
 * Version: 4.1.0
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Core Intelligence Stack
const config = require('./src/utils/config-loader');
const memoryStore = require('./src/memory/memory-store');
const brainRouter = require('./src/brains/brain-router');
const voiceEngine = require('./src/engines/voice-engine');
const instagramInterface = require('./src/platforms/instagram-interface');
const summarizer = require('./src/engines/summarizer');
const reminderEngine = require('./src/engines/reminder-engine');
const autoReplyEngine = require('./src/engines/autoreply-engine');
const analyticsEngine = require('./src/engines/analytics-engine');

// Global socket reference
let globalSock = null;
let latestQR = null;

// ═══════════════════════════════════════
// EXPRESS WEB SERVER (QR + Webhooks)
// ═══════════════════════════════════════

const app = express();
app.use(express.json());

// QR Code page
app.get('/', (req, res) => {
    if (!latestQR) {
        return res.send(`
            <html><body style="background:#111;color:#fff;font-family:monospace;text-align:center;padding:40px">
                <h1>🧠 Manthan AI v4.1</h1>
                <p>WhatsApp is either connected or waiting for QR generation...</p>
                <p>Refresh in a few seconds.</p>
            </body></html>
        `);
    }

    QRCode.toDataURL(latestQR, (err, url) => {
        res.send(`
            <html><body style="background:#111;color:#fff;font-family:monospace;text-align:center;padding:40px">
                <h1>🧠 Manthan AI v4.1</h1>
                <h2>📱 Scan to Connect WhatsApp</h2>
                <img src="${url}" style="width:300px;border-radius:12px;margin:20px" />
                <p style="color:#888">This page auto-refreshes every 30 seconds</p>
                <script>setTimeout(() => location.reload(), 30000)</script>
            </body></html>
        `);
    });
});

// Health check
app.get('/health', (req, res) => {
    const stats = memoryStore.getStats();
    res.json({
        status: 'online',
        version: '4.1.0',
        brains: ['chat', 'knowledge', 'search', 'youtube', 'social', 'safety'],
        engines: ['voice', 'summarizer', 'ab-testing'],
        platforms: ['whatsapp', instagramInterface.isConfigured ? 'instagram' : 'instagram (not configured)'],
        memory: stats,
        uptime: process.uptime()
    });
});

// A/B Test report
app.get('/ab-report', (req, res) => {
    res.json({ report: brainRouter.getABReport() });
});

// Daily digest
app.get('/digest', async (req, res) => {
    const digest = await brainRouter.getDailyDigest();
    res.json({ digest });
});

// Analytics API
app.get('/api/analytics', (req, res) => {
    const data = analyticsEngine.getData();
    data.mode = autoReplyEngine.getMode();
    data.reminders = reminderEngine.getActiveCount();
    res.json(data);
});

// Analytics Dashboard
app.get('/dashboard', (req, res) => {
    res.send(getDashboardHTML());
});

// Instagram webhook
instagramInterface.setupWebhook(app, async (senderId, messageText, messageType) => {
    console.log(`\n📸 Instagram ${messageType} from ${senderId}: ${messageText}`);
    const result = await brainRouter.process(`ig_${senderId}`, messageText, {
        isGroup: false,
        phoneNumber: senderId
    });
    return result?.response || null;
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
    console.log(`📈 Dashboard: http://localhost:${PORT}/dashboard`);
});

// ═══════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════

function getMessageText(msg) {
    if (!msg.message) return null;
    if (msg.message.conversation) return msg.message.conversation;
    if (msg.message.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
    if (msg.message.imageMessage?.caption) return msg.message.imageMessage.caption;
    if (msg.message.videoMessage?.caption) return msg.message.videoMessage.caption;
    // Forwarded / ephemeral wrapped messages
    const wrapped = msg.message.ephemeralMessage?.message || msg.message.viewOnceMessage?.message || msg.message.viewOnceMessageV2?.message;
    if (wrapped) {
        if (wrapped.conversation) return wrapped.conversation;
        if (wrapped.extendedTextMessage?.text) return wrapped.extendedTextMessage.text;
        if (wrapped.imageMessage?.caption) return wrapped.imageMessage.caption;
        if (wrapped.videoMessage?.caption) return wrapped.videoMessage.caption;
    }
    return null;
}

function hasImageMessage(msg) {
    if (!msg.message) return false;
    // Direct image
    if (msg.message.imageMessage) return true;
    // Forwarded / ephemeral wrapped image
    if (msg.message.ephemeralMessage?.message?.imageMessage) return true;
    if (msg.message.viewOnceMessage?.message?.imageMessage) return true;
    if (msg.message.viewOnceMessageV2?.message?.imageMessage) return true;
    if (msg.message.documentWithCaptionMessage?.message?.imageMessage) return true;
    return false;
}

function getQuotedText(msg) {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo ||
        msg.message?.imageMessage?.contextInfo;
    if (!contextInfo?.quotedMessage) return '';
    const qm = contextInfo.quotedMessage;
    return qm.conversation || qm.extendedTextMessage?.text || qm.imageMessage?.caption || '';
}

function stripBotMention(text) {
    if (!text) return text;
    // Remove @bot / @Bot prefix and clean up
    return text.replace(/^@bot\s*/i, '').trim();
}

function formatPhoneNumber(jid) {
    if (!jid) return 'Unknown';
    return '+' + jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
}

async function simulateTyping(sock, jid, duration = 2000) {
    try {
        await sock.presenceSubscribe(jid);
        await sock.sendPresenceUpdate('composing', jid);
        await new Promise(resolve => setTimeout(resolve, duration));
        await sock.sendPresenceUpdate('paused', jid);
    } catch (error) {
        // Ignore typing simulation errors
    }
}

// ═══════════════════════════════════════
// OWNER COMMANDS
// ═══════════════════════════════════════

async function handleOwnerCommand(sock, sender, command) {
    const cmd = command.toLowerCase().trim();

    // Auto-reply engine commands (/away, /dnd, /busy, /online, /status, /auto)
    const autoReplyResult = autoReplyEngine.handleCommand(cmd);
    if (autoReplyResult.handled) {
        await sock.sendMessage(sender, { text: autoReplyResult.response });
        console.log(`🕒 Auto-reply: ${cmd}`);
        return true;
    }

    switch (cmd) {
        case '/bot on':
        case '/resume':
            memoryStore.releaseOwnerTakeover(sender);
            console.log(`🤖 Bot manually resumed for ${formatPhoneNumber(sender)}`);
            return true;

        case '/bot off':
        case '/pause':
            memoryStore.setOwnerTakeover(sender);
            console.log(`⏸️ Bot paused for ${formatPhoneNumber(sender)} (manual)`);
            return true;

        case '/stats': {
            const stats = memoryStore.getStats();
            const analytics = analyticsEngine.getData();
            const statsMsg = `📊 *Manthan AI v5.0 Stats*\n` +
                `• Persons: ${stats.totalPersons}\n` +
                `• Messages: ${stats.totalMessages}\n` +
                `• Processed: ${analytics.totalProcessed}\n` +
                `• Avg Response: ${analytics.avgResponseTime}ms\n` +
                `• Reminders: ${reminderEngine.getActiveCount()}\n` +
                `• Mode: ${autoReplyEngine.getMode()}\n` +
                `• Uptime: ${(process.uptime() / 60).toFixed(1)} min\n` +
                `• Dashboard: http://localhost:${PORT}/dashboard`;
            await sock.sendMessage(sender, { text: statsMsg });
            console.log(`📊 Stats sent to owner`);
            return true;
        }

        case '/ab report':
        case '/ab': {
            const report = brainRouter.getABReport();
            await sock.sendMessage(sender, { text: report });
            console.log(`🧪 A/B Report sent to owner`);
            return true;
        }

        case '/digest': {
            const digest = await brainRouter.getDailyDigest();
            await sock.sendMessage(sender, { text: digest });
            console.log(`📝 Daily digest sent to owner`);
            return true;
        }

        case '/help': {
            const helpMsg = `📋 *Owner Commands*\n\n` +
                `*Bot Control:*\n` +
                `/pause — Pause bot\n` +
                `/resume — Resume bot\n` +
                `/stats — Show stats\n` +
                `/ab — A/B test report\n` +
                `/digest — Daily digest\n\n` +
                `*Auto-Reply Modes:*\n` +
                `/away <msg> — Away mode\n` +
                `/dnd — Do not disturb\n` +
                `/busy <duration> — Busy mode\n` +
                `/auto <msg> — Custom auto-reply\n` +
                `/online — Back to normal\n` +
                `/status — Current mode\n\n` +
                `*Self-Use:*\n` +
                `@bot <query> — Search/AI for yourself`;
            await sock.sendMessage(sender, { text: helpMsg });
            return true;
        }

        default:
            return false;
    }
}

// ═══════════════════════════════════════
// MAIN BOT
// ═══════════════════════════════════════

async function startBot() {
    // Wait for sql.js database to be ready
    await memoryStore.ensureReady();

    const botName = config.profile.name || 'Manthan AI';

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║         🧠 MANTHAN AI — ULTIMATE OMNI BOT v4.1              ║');
    console.log('║   Multi-Brain | EQ | Voice | Search | YouTube | Instagram   ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`📍 ${config.profile.role || 'AI Assistant'}`);
    console.log(`🕐 ${config.getTimeContext().date} | ${config.getTimeContext().time} IST`);
    console.log(`📊 Memory: ${memoryStore.getStats().totalPersons} persons, ${memoryStore.getStats().totalMessages} messages`);
    console.log('');

    if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️  GEMINI_API_KEY not set! Bot will run with offline brains only.');
    }
    if (!process.env.YOUTUBE_API_KEY) {
        console.warn('⚠️  YOUTUBE_API_KEY not set. YouTube search uses Invidious fallback.');
    }
    if (!instagramInterface.isConfigured) {
        console.warn('⚠️  Instagram not configured. Set INSTAGRAM_ACCESS_TOKEN & INSTAGRAM_ACCOUNT_ID.');
    }
    console.log('');

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        syncFullHistory: false,
        printQRInTerminal: false
    });

    globalSock = sock;

    sock.ev.on('creds.update', saveCreds);

    // ─── Connection Management ─────────────
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            latestQR = qr;
            console.log('');
            console.log('═'.repeat(60));
            console.log('📱 SCAN THIS QR CODE WITH YOUR WHATSAPP');
            console.log('═'.repeat(60));
            const qrString = await QRCode.toString(qr, { type: 'terminal', small: true });
            console.log(qrString);
            console.log(`🌐 Or open http://localhost:${PORT} in your browser to scan`);
            console.log('');
        }

        if (connection === 'close') {
            latestQR = null;
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`❌ Connection closed. Reconnecting: ${shouldReconnect}`);
            if (shouldReconnect) {
                setTimeout(startBot, 3000);
            }
        } else if (connection === 'open') {
            latestQR = null;
            reminderEngine.setSocket(sock); // Wire up reminders
            console.log('');
            console.log('╔══════════════════════════════════════════════════════════════╗');
            console.log(`║  ✅ ${botName}'s Brain v6.0 is ONLINE!                       ║`);
            console.log('╠══════════════════════════════════════════════════════════════╣');
            console.log('║  BRAINS                        ENGINES                      ║');
            console.log('║  💬 Chat (Gemini AI)           🎤 Voice (Google TTS)        ║');
            console.log('║  📚 Knowledge (NLP + KB)       📝 Summarizer (Gemini)       ║');
            console.log('║  🔍 Search (DuckDuckGo)        🧪 A/B Testing               ║');
            console.log('║  📹 YouTube (API + Invidious)  ⏰ Reminder Engine            ║');
            console.log('║  🔗 Link Preview               🕒 Auto-Reply Engine         ║');
            console.log('║  🎵 Music Search               📈 Analytics Dashboard       ║');
            console.log('║  🌐 Translation (Gemini)       PLATFORMS                    ║');
            console.log('║  🎮 Mini Games                  📱 WhatsApp ✓               ║');
            console.log('║  💰 Finance (CoinGecko)         📸 Instagram                ║');
            console.log('║  🤝 Social + 🛡️ Safety + 🎭 Humanizer                      ║');
            console.log('╚══════════════════════════════════════════════════════════════╝');
            console.log('');
            console.log('📋 Owner Commands: /help | /stats | /away | /dnd | /busy | /online');
            console.log(`📈 Dashboard: http://localhost:${PORT}/dashboard`);
            console.log('👂 Listening for messages...');
            console.log('─'.repeat(60));
        }
    });

    // ─── Message Handler ────────────────────
    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
            const sender = msg.key.remoteJid;
            const isGroup = sender?.includes('@g.us');

            // Skip status updates
            if (sender === 'status@broadcast') continue;

            // ════════════════════════════════════
            // GROUP: Check if bot should respond
            // ════════════════════════════════════
            if (isGroup) {
                const messageText = getMessageText(msg);

                const userJid = sock.user?.id || state.creds.me?.id;
                const botJid = userJid ? userJid.split(':')[0] + '@s.whatsapp.net' : null;

                const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
                const mentions = contextInfo?.mentionedJid || [];
                const isMentioned = botJid ? mentions.includes(botJid) : false;

                const quotedParticipant = contextInfo?.participant;
                const isQuoted = botJid ? quotedParticipant === botJid : false;

                const isNameMentioned = messageText && /manthan|@manthan|@bot/i.test(messageText);

                // Also respond to image messages with @bot mention or in reply to bot
                const hasImage = hasImageMessage(msg);
                const imageCaption = hasImage ? getMessageText(msg) : '';
                const imageHasBotMention = hasImage && imageCaption && /manthan|@bot/i.test(imageCaption);

                if (!isMentioned && !isQuoted && !isNameMentioned && !imageHasBotMention) {
                    continue;
                }

                console.log(`\n🔔 Group mention/quote detected!`);
            }

            // ════════════════════════════════════
            // OWNER MESSAGE: Commands + @bot + Pause
            // ════════════════════════════════════
            if (msg.key.fromMe) {
                const messageText = getMessageText(msg);
                if (messageText && messageText.trim() !== '') {
                    const contactPhone = formatPhoneNumber(sender);
                    const lowerText = messageText.toLowerCase().trim();

                    // Check for owner commands
                    if (lowerText.startsWith('/')) {
                        const handled = await handleOwnerCommand(sock, sender, lowerText);
                        if (handled) continue;
                    }

                    // ═══ @bot query — Owner self-search ═══
                    // When owner sends "@bot <query>", process through the full brain pipeline
                    const botTriggerMatch = messageText.match(/^@bot\s+(.+)/i);
                    if (botTriggerMatch) {
                        const ownerQuery = botTriggerMatch[1].trim();
                        console.log(`\n🔍 Owner @bot query: ${ownerQuery}`);

                        try {
                            const result = await brainRouter.process(sender, ownerQuery, {
                                isGroup: false,
                                phoneNumber: contactPhone,
                                voiceRequest: voiceEngine.isVoiceRequest(ownerQuery)
                            });

                            if (result && result.response) {
                                // Simulate typing
                                const typingDelay = result.typingDelay || 1500;
                                await simulateTyping(sock, sender, typingDelay);

                                // Send response back to the same chat
                                await sock.sendMessage(sender, { text: result.response });

                                // Send voice if requested
                                if (voiceEngine.isVoiceRequest(ownerQuery) && result.response) {
                                    const lang = voiceEngine.detectLanguage(result.response);
                                    console.log(`   🎤 Generating voice reply (${lang})...`);
                                    await voiceEngine.sendVoiceMessage(sock, sender, result.response, {
                                        language: lang
                                    });
                                }

                                const sourceTag = result.source || 'unknown';
                                console.log(`✅ Owner @bot reply [${sourceTag}] in ${result.processingTime}ms`);
                            } else {
                                await sock.sendMessage(sender, { text: "Couldn't find anything for that query 😅" });
                            }
                        } catch (error) {
                            console.error(`❌ Owner @bot error: ${error.message}`);
                            await sock.sendMessage(sender, { text: "Something went wrong processing your query 😅" });
                        }
                        continue;
                    }

                    // Regular owner message → BOT GOES SILENT FOR 30 SECONDS
                    const TAKEOVER_MS = 30000; // 30 seconds silence
                    memoryStore.updateOwnerActivity(sender);
                    const remaining = Math.ceil(memoryStore.getOwnerTakeoverTimeRemaining(sender, TAKEOVER_MS) / 1000);
                    console.log(`👤 Manthan replied → Bot SILENT for ${remaining}s for ${contactPhone}`);
                }
                continue;
            }

            // ════════════════════════════════════
            // INCOMING MESSAGE (text or image)
            // ════════════════════════════════════
            let messageText = getMessageText(msg);
            const hasImage = hasImageMessage(msg);
            const quotedText = getQuotedText(msg);

            // Skip if no text AND no image
            if ((!messageText || messageText.trim() === '') && !hasImage) continue;

            // Strip @bot prefix from message
            if (messageText) {
                messageText = stripBotMention(messageText);
            }

            const phoneNumber = formatPhoneNumber(sender);
            console.log('');
            console.log(`${isGroup ? '👥' : '📩'} ${phoneNumber}: ${hasImage ? '📷 [image]' : ''} ${messageText || ''}`);
            if (quotedText) console.log(`   ↩️ Replying to: ${quotedText.substring(0, 60)}...`);

            // Check owner takeover — always active, 30s silence
            const TAKEOVER_MS = 30000;
            if (memoryStore.isOwnerHandling(sender, TAKEOVER_MS)) {
                const remaining = Math.ceil(memoryStore.getOwnerTakeoverTimeRemaining(sender, TAKEOVER_MS) / 1000);
                console.log(`⏸️ Bot SILENT (Manthan is handling, ${remaining}s remaining)`);
                console.log('─'.repeat(60));
                continue;
            }

            // Check auto-reply mode (away/dnd/busy)
            const autoReply = autoReplyEngine.getAutoReply(sender);
            if (autoReply) {
                if (autoReply === '__DND__') {
                    console.log(`🔇 DND mode — ignoring message`);
                    console.log('─'.repeat(60));
                    continue;
                }
                // Send auto-reply
                await sock.sendMessage(sender, { text: autoReply }, isGroup ? { quoted: msg } : undefined);
                console.log(`🕒 Auto-reply sent (${autoReplyEngine.getMode()} mode)`);
                console.log('─'.repeat(60));
                continue;
            }

            // Check if voice reply is requested
            const wantsVoice = voiceEngine.isVoiceRequest(messageText);

            try {
                // ═══════════════════════════════════
                // FULL INTELLIGENCE PIPELINE
                // ═══════════════════════════════════

                // Download image if present
                let imageBuffer = null;
                if (hasImage) {
                    try {
                        imageBuffer = await downloadMediaMessage(msg, 'buffer', {});
                        console.log(`   📷 Image downloaded (${(imageBuffer.length / 1024).toFixed(1)}KB)`);
                    } catch (dlErr) {
                        console.error(`   ❌ Image download failed: ${dlErr.message}`);
                    }
                }

                const result = await brainRouter.process(sender, messageText || '', {
                    isGroup,
                    phoneNumber,
                    voiceRequest: wantsVoice,
                    imageBuffer,
                    imageCaption: hasImage ? (messageText || '') : '',
                    quotedText
                });

                if (!result || !result.response) {
                    throw new Error('Empty response from Brain Router');
                }

                // Simulate typing (humanized delay)
                const typingDelay = result.typingDelay || 1500;
                await simulateTyping(sock, sender, typingDelay);

                // Send text response
                await sock.sendMessage(
                    sender,
                    { text: result.response },
                    isGroup ? { quoted: msg } : undefined
                );

                // Send meme image if this is a meme result
                if (result.isMeme && result.imageUrl) {
                    try {
                        const memeResp = await fetch(result.imageUrl, { signal: AbortSignal.timeout(15000) });
                        const memeBuffer = Buffer.from(await memeResp.arrayBuffer());
                        await sock.sendMessage(
                            sender,
                            { image: memeBuffer, caption: result.response || '😂' },
                            isGroup ? { quoted: msg } : undefined
                        );
                        console.log(`   🖼️ Meme sent (${(memeBuffer.length / 1024).toFixed(1)}KB)`);
                    } catch (memeErr) {
                        console.error(`   ⚠️ Meme image send failed: ${memeErr.message}`);
                    }
                }

                // Send song audio if music-brain downloaded it
                if (result.hasAudio && result.audioBuffer) {
                    try {
                        await sock.sendMessage(
                            sender,
                            {
                                audio: result.audioBuffer,
                                mimetype: result.audioMimetype || 'audio/mpeg',
                                ptt: false // Not a voice note, it's a song
                            },
                            isGroup ? { quoted: msg } : undefined
                        );
                        console.log(`   🎵 Song audio sent (${(result.audioBuffer.length / 1024 / 1024).toFixed(2)}MB)`);
                    } catch (audioErr) {
                        console.error(`   ⚠️ Song audio send failed: ${audioErr.message}`);
                    }
                }

                // Send voice note if requested
                if (wantsVoice && result.response) {
                    const lang = voiceEngine.detectLanguage(result.response);
                    console.log(`   🎤 Generating voice reply (${lang})...`);
                    await voiceEngine.sendVoiceMessage(sock, sender, result.response, {
                        language: lang
                    });
                }

                // Log
                const sourceTag = result.source || 'unknown';
                console.log(`✅ Replied [${sourceTag}] in ${result.processingTime}ms${wantsVoice ? ' + 🎤 Voice' : ''}`);

                if (result.intent) {
                    console.log(`   🎯 ${result.intent.primary}/${result.intent.subIntent || '-'} | 💭 ${result.emotion?.primary || 'neutral'} (${result.emotion?.intensity || '-'})`);
                }

            } catch (error) {
                console.error(`❌ Error: ${error.message}`);

                const fallbackMessage = isGroup
                    ? "bruh my brain just crashed 😅"
                    : "hey sorry, had a brain freeze moment 😅 text me again?";

                try {
                    await sock.sendMessage(sender, { text: fallbackMessage }, isGroup ? { quoted: msg } : undefined);
                } catch (sendError) {
                    console.error(`❌ Failed to send fallback: ${sendError.message}`);
                }
            }

            console.log('─'.repeat(60));
        }
    });

    // ─── Periodic Tasks ─────────────────────
    // Cleanup every hour
    setInterval(() => {
        memoryStore.cleanup();
        voiceEngine.cleanup();
        summarizer.clearCache();
        const stats = memoryStore.getStats();
        console.log(`🧹 Cleanup done | ${stats.totalPersons} persons, ${stats.totalMessages} msgs`);
    }, 60 * 60 * 1000);

    // Daily digest at 11 PM
    setInterval(async () => {
        const hour = new Date().getHours();
        if (hour === 23) {
            const digest = await brainRouter.getDailyDigest();
            console.log('\n📝 Daily Digest:\n' + digest);
        }
    }, 60 * 60 * 1000);
}

// ═══════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════

function shutdown() {
    console.log('\n👋 Shutting down Manthan AI v5.0...');
    try {
        reminderEngine.cleanup();
        memoryStore.close();
    } catch (e) { }
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ═══════════════════════════════════════
// START
// ═══════════════════════════════════════

startBot().catch(err => {
    console.error('❌ Failed to start Manthan AI:', err);
    process.exit(1);
});

// ═══════════════════════════════════════
// ANALYTICS DASHBOARD HTML
// ═══════════════════════════════════════
function getDashboardHTML() {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Manthan AI Dashboard</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;background:#0f0f23;color:#e0e0e0;min-height:100vh;padding:20px}
h1{text-align:center;font-size:28px;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px}
.sub{text-align:center;color:#888;font-size:13px;margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:24px}
.card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px;text-align:center;backdrop-filter:blur(10px)}
.card .val{font-size:32px;font-weight:700;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.card .lbl{font-size:12px;color:#888;margin-top:4px;text-transform:uppercase;letter-spacing:1px}
.section{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:20px;margin-bottom:20px}
.section h2{font-size:16px;margin-bottom:14px;color:#a78bfa}
.bar-chart{display:flex;align-items:flex-end;gap:4px;height:120px;padding-top:10px}
.bar{flex:1;background:linear-gradient(to top,#667eea,#764ba2);border-radius:4px 4px 0 0;min-width:8px;position:relative;transition:height 0.5s}
.bar:hover{opacity:0.8}.bar .tip{display:none;position:absolute;top:-24px;left:50%;transform:translateX(-50%);background:#333;padding:2px 6px;border-radius:4px;font-size:10px;white-space:nowrap}
.bar:hover .tip{display:block}
.list{list-style:none}.list li{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px}
.list li span:last-child{color:#a78bfa;font-weight:600}
.mode-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase}
.mode-online{background:rgba(34,197,94,0.15);color:#22c55e}.mode-away{background:rgba(234,179,8,0.15);color:#eab308}
.mode-dnd{background:rgba(239,68,68,0.15);color:#ef4444}.mode-busy{background:rgba(249,115,22,0.15);color:#f97316}
.refresh-btn{position:fixed;bottom:20px;right:20px;background:linear-gradient(135deg,#667eea,#764ba2);border:none;color:#fff;padding:12px 24px;border-radius:30px;cursor:pointer;font-size:14px;box-shadow:0 4px 15px rgba(102,126,234,0.3)}
</style></head><body>
<h1>🧠 Manthan AI v5.0</h1>
<div class="sub">Real-time Analytics Dashboard • <span id="time"></span></div>
<div class="grid" id="cards"></div>
<div style="display:grid;grid-template-columns:2fr 1fr;gap:20px">
<div class="section"><h2>📊 Hourly Messages</h2><div class="bar-chart" id="hourly"></div><div style="display:flex;justify-content:space-between;font-size:10px;color:#666;margin-top:4px"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div></div>
<div><div class="section"><h2>🧠 Brain Usage</h2><ul class="list" id="brains"></ul></div>
<div class="section"><h2>🎯 Top Intents</h2><ul class="list" id="intents"></ul></div></div>
</div>
<div class="section"><h2>👥 Top Contacts</h2><ul class="list" id="contacts"></ul></div>
<button class="refresh-btn" onclick="loadData()">🔄 Refresh</button>
<script>
function fmt(s){const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h>0?h+'h '+m+'m':m+'m'}
function loadData(){fetch('/api/analytics').then(r=>r.json()).then(d=>{
document.getElementById('time').textContent=new Date().toLocaleTimeString();
const mc='mode-'+(d.mode||'online');
document.getElementById('cards').innerHTML=
'<div class="card"><div class="val">'+d.totalProcessed+'</div><div class="lbl">Processed</div></div>'+
'<div class="card"><div class="val">'+d.totalPersons+'</div><div class="lbl">Contacts</div></div>'+
'<div class="card"><div class="val">'+d.totalMessages+'</div><div class="lbl">Total Msgs</div></div>'+
'<div class="card"><div class="val">'+d.avgResponseTime+'ms</div><div class="lbl">Avg Response</div></div>'+
'<div class="card"><div class="val">'+fmt(d.uptime)+'</div><div class="lbl">Uptime</div></div>'+
'<div class="card"><div class="val"><span class="mode-badge '+mc+'">'+(d.mode||'online')+'</span></div><div class="lbl">Mode</div></div>'+
'<div class="card"><div class="val">'+(d.reminders||0)+'</div><div class="lbl">Reminders</div></div>';
const mx=Math.max(...d.hourlyMessages,1);
document.getElementById('hourly').innerHTML=d.hourlyMessages.map((v,i)=>'<div class="bar" style="height:'+Math.max(v/mx*100,2)+'%"><span class="tip">'+i+':00 - '+v+'</span></div>').join('');
document.getElementById('brains').innerHTML=(d.brainUsage||[]).map(b=>'<li><span>'+b.brain+'</span><span>'+b.count+'</span></li>').join('')||'<li>No data yet</li>';
document.getElementById('intents').innerHTML=(d.topIntents||[]).map(i=>'<li><span>'+i.intent+'</span><span>'+i.count+'</span></li>').join('')||'<li>No data yet</li>';
document.getElementById('contacts').innerHTML=(d.topContacts||[]).map(c=>'<li><span>'+c.id+'</span><span>'+c.count+' msgs</span></li>').join('')||'<li>No data yet</li>';
}).catch(e=>console.error(e))}
loadData();setInterval(loadData,15000);
</script></body></html>`;
}
