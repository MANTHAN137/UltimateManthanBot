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

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
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

// Instagram webhook
instagramInterface.setupWebhook(app, async (senderId, messageText, messageType) => {
    console.log(`\n📸 Instagram ${messageType} from ${senderId}: ${messageText}`);

    // Use brain router to process (just like WhatsApp)
    const result = await brainRouter.process(`ig_${senderId}`, messageText, {
        isGroup: false,
        phoneNumber: senderId
    });

    return result?.response || null;
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
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
    return null;
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
            const statsMsg = `📊 *Manthan AI Stats*\n` +
                `• Persons: ${stats.totalPersons}\n` +
                `• Messages: ${stats.totalMessages}\n` +
                `• Safety Rules: ${stats.safetyRules}\n` +
                `• Uptime: ${(process.uptime() / 60).toFixed(1)} min`;
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

        default:
            return false; // Not a recognized command
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
            console.log('');
            console.log('╔══════════════════════════════════════════════════════════════╗');
            console.log(`║  ✅ ${botName}'s Brain is ONLINE!                            ║`);
            console.log('╠══════════════════════════════════════════════════════════════╣');
            console.log('║  BRAINS                        ENGINES                      ║');
            console.log('║  💬 Chat (Gemini AI)           🎤 Voice (Google TTS)        ║');
            console.log('║  📚 Knowledge (NLP + KB)       📝 Summarizer (Gemini)       ║');
            console.log('║  🔍 Search (DuckDuckGo)        🧪 A/B Testing               ║');
            console.log('║  📹 YouTube (API + Invidious)                               ║');
            console.log('║  🤝 Social (Quick Responses)   PLATFORMS                    ║');
            console.log('║  🛡️ Safety (Content Filter)    📱 WhatsApp ✓                ║');
            console.log('║  🎭 Humanizer (Tone + Delay)   📸 Instagram                 ║');
            console.log('╚══════════════════════════════════════════════════════════════╝');
            console.log('');
            console.log('📋 Owner Commands: /stats | /ab | /digest | /pause | /resume');
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

                if (!isMentioned && !isQuoted && !isNameMentioned) {
                    continue;
                }

                console.log(`\n🔔 Group mention/quote detected!`);
            }

            // ════════════════════════════════════
            // OWNER MESSAGE: Commands + Pause
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

                    // Regular owner message → BOT GOES SILENT FOR 30 SECONDS
                    const TAKEOVER_MS = 30000; // 30 seconds silence
                    memoryStore.updateOwnerActivity(sender);
                    const remaining = Math.ceil(memoryStore.getOwnerTakeoverTimeRemaining(sender, TAKEOVER_MS) / 1000);
                    console.log(`👤 Manthan replied → Bot SILENT for ${remaining}s for ${contactPhone}`);
                }
                continue;
            }

            // ════════════════════════════════════
            // INCOMING MESSAGE
            // ════════════════════════════════════
            const messageText = getMessageText(msg);
            if (!messageText || messageText.trim() === '') continue;

            const phoneNumber = formatPhoneNumber(sender);
            console.log('');
            console.log(`${isGroup ? '👥' : '📩'} ${phoneNumber}: ${messageText}`);

            // Check owner takeover — always active, 30s silence
            const TAKEOVER_MS = 30000;
            if (memoryStore.isOwnerHandling(sender, TAKEOVER_MS)) {
                const remaining = Math.ceil(memoryStore.getOwnerTakeoverTimeRemaining(sender, TAKEOVER_MS) / 1000);
                console.log(`⏸️ Bot SILENT (Manthan is handling, ${remaining}s remaining)`);
                console.log('─'.repeat(60));
                continue;
            }

            // Check if voice reply is requested
            const wantsVoice = voiceEngine.isVoiceRequest(messageText);

            try {
                // ═══════════════════════════════════
                // FULL INTELLIGENCE PIPELINE
                // ═══════════════════════════════════
                const result = await brainRouter.process(sender, messageText, {
                    isGroup,
                    phoneNumber,
                    voiceRequest: wantsVoice
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
    console.log('\n👋 Shutting down Manthan AI v4.1...');
    try {
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
