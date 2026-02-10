/**
 * Voice Engine
 * Text-to-Speech for WhatsApp audio messages
 * Uses Google TTS (no API key needed)
 * 
 * Capabilities:
 * - Convert text to speech audio
 * - Send as WhatsApp PTT (push-to-talk) audio message
 * - Supports English and Hindi
 * - Auto-detects language for TTS
 */

const googleTTS = require('google-tts-api');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const TEMP_DIR = path.join(__dirname, '../../data/temp');

class VoiceEngine {
    constructor() {
        // Ensure temp directory exists
        if (!fs.existsSync(TEMP_DIR)) {
            fs.mkdirSync(TEMP_DIR, { recursive: true });
        }

        console.log('🎤 Voice Engine initialized (Google TTS)');
    }

    /**
     * Generate voice message and send via WhatsApp
     * @param {Object} sock - Baileys socket
     * @param {string} jid - Recipient JID
     * @param {string} text - Text to convert to speech
     * @param {Object} options - { language, speed }
     */
    async sendVoiceMessage(sock, jid, text, options = {}) {
        const { language = 'en', speed = 1.0 } = options;

        try {
            // Clean text for TTS (remove emojis, markdown, etc.)
            const cleanText = this._cleanForTTS(text);

            if (!cleanText || cleanText.length < 2) {
                console.log('   🎤 Voice: Text too short for TTS');
                return false;
            }

            // Google TTS has a character limit, split if needed
            const chunks = this._splitText(cleanText, 200);

            // Generate audio buffers for each chunk
            const audioBuffers = [];

            for (const chunk of chunks) {
                const buffer = await this._getAudioBuffer(chunk, language, speed);
                if (buffer) {
                    audioBuffers.push(buffer);
                }
            }

            if (audioBuffers.length === 0) {
                console.error('   ❌ Voice: No audio generated');
                return false;
            }

            // Combine all buffers
            const combinedBuffer = Buffer.concat(audioBuffers);

            // Save temp file
            const tempFile = path.join(TEMP_DIR, `voice_${Date.now()}.mp3`);
            fs.writeFileSync(tempFile, combinedBuffer);

            // Send as WhatsApp PTT audio
            await sock.sendMessage(jid, {
                audio: fs.readFileSync(tempFile),
                mimetype: 'audio/mp4',
                ptt: true // Push-to-talk (voice note style)
            });

            // Cleanup temp file
            try { fs.unlinkSync(tempFile); } catch (e) { }

            console.log(`   🎤 Voice message sent (${chunks.length} chunks, ${combinedBuffer.length} bytes)`);
            return true;

        } catch (error) {
            console.error(`   ❌ Voice Engine error: ${error.message}`);
            return false;
        }
    }

    /**
     * Get audio buffer from Google TTS
     */
    async _getAudioBuffer(text, language = 'en', speed = 1.0) {
        try {
            // Get TTS URL
            const url = googleTTS.getAudioUrl(text, {
                lang: language,
                slow: speed < 0.8,
                host: 'https://translate.google.com'
            });

            // Download audio
            const buffer = await this._downloadBuffer(url);
            return buffer;

        } catch (error) {
            console.error(`   ❌ TTS chunk error: ${error.message}`);
            return null;
        }
    }

    /**
     * Download URL to buffer
     */
    _downloadBuffer(url) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;

            protocol.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, (response) => {
                // Handle redirects
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    return this._downloadBuffer(response.headers.location).then(resolve).catch(reject);
                }

                if (response.statusCode !== 200) {
                    return reject(new Error(`HTTP ${response.statusCode}`));
                }

                const chunks = [];
                response.on('data', chunk => chunks.push(chunk));
                response.on('end', () => resolve(Buffer.concat(chunks)));
                response.on('error', reject);
            }).on('error', reject);
        });
    }

    /**
     * Split text into chunks for TTS (Google has 200 char limit per request)
     */
    _splitText(text, maxLen = 200) {
        if (text.length <= maxLen) return [text];

        const chunks = [];
        let remaining = text;

        while (remaining.length > 0) {
            if (remaining.length <= maxLen) {
                chunks.push(remaining);
                break;
            }

            // Find a natural break point
            let breakAt = maxLen;

            // Try sentence end
            const sentenceEnd = remaining.lastIndexOf('.', maxLen);
            if (sentenceEnd > maxLen * 0.5) {
                breakAt = sentenceEnd + 1;
            } else {
                // Try comma
                const commaPos = remaining.lastIndexOf(',', maxLen);
                if (commaPos > maxLen * 0.5) {
                    breakAt = commaPos + 1;
                } else {
                    // Try space
                    const spacePos = remaining.lastIndexOf(' ', maxLen);
                    if (spacePos > maxLen * 0.3) {
                        breakAt = spacePos + 1;
                    }
                }
            }

            chunks.push(remaining.substring(0, breakAt).trim());
            remaining = remaining.substring(breakAt).trim();
        }

        return chunks;
    }

    /**
     * Clean text for TTS output
     */
    _cleanForTTS(text) {
        return text
            // Remove emojis
            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
            // Remove markdown formatting
            .replace(/\*+/g, '')
            .replace(/_+/g, '')
            .replace(/~+/g, '')
            .replace(/`+/g, '')
            // Remove URLs
            .replace(/https?:\/\/\S+/g, '')
            // Remove special WhatsApp formatting
            .replace(/[\n\r]+/g, '. ')
            // Clean up whitespace
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Detect language for TTS
     * Returns 'hi' for Hindi/Devanagari, 'en' for English
     */
    detectLanguage(text) {
        // Devanagari script
        if (/[\u0900-\u097F]/.test(text)) return 'hi';
        // Mostly Hindi words (Romanized)
        const hindiWords = text.match(/\b(kya|hai|hain|nahi|acha|theek|kaise|kyun|mein|tum|hum|uska|mera)\b/gi);
        if (hindiWords && hindiWords.length > 3) return 'hi';
        return 'en';
    }

    /**
     * Check if user is requesting voice reply
     */
    isVoiceRequest(message) {
        const msg = message.toLowerCase();
        return /\b(voice|audio|bol|bolo|sun|suna|speak|say it|read it|padhke suna|voice mein|voice me|record)\b/i.test(msg);
    }

    /**
     * Clean up temp directory
     */
    cleanup() {
        try {
            const files = fs.readdirSync(TEMP_DIR);
            const now = Date.now();
            for (const file of files) {
                const filePath = path.join(TEMP_DIR, file);
                const stat = fs.statSync(filePath);
                // Delete files older than 1 hour
                if (now - stat.mtimeMs > 60 * 60 * 1000) {
                    fs.unlinkSync(filePath);
                }
            }
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

module.exports = new VoiceEngine();
