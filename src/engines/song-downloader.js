/**
 * Song Download Engine v2.0
 * Downloads audio from YouTube for sending as WhatsApp audio messages
 * Primary: @distube/ytdl-core (direct YouTube download, no external API)
 * Fallback: Invidious audio streams
 */

const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const TEMP_DIR = path.join(__dirname, '../../data/temp');

class SongDownloader {
    constructor() {
        this.INVIDIOUS_INSTANCES = [
            'https://vid.puffyan.us',
            'https://invidious.snopyta.org',
            'https://yewtu.be',
            'https://inv.nadeko.net'
        ];

        this.MAX_DURATION_SEC = 420; // Max 7 min songs
        this.MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB WhatsApp limit

        // Ensure temp directory exists
        if (!fs.existsSync(TEMP_DIR)) {
            fs.mkdirSync(TEMP_DIR, { recursive: true });
        }

        console.log('🎶 Song Downloader v2.0 initialized (ytdl-core)');
    }

    /**
     * Download audio from a YouTube URL
     * @param {string} youtubeUrl - YouTube URL or video ID
     * @returns {{ buffer: Buffer, mimetype: string, filename: string } | null}
     */
    async downloadAudio(youtubeUrl) {
        if (!youtubeUrl) return null;

        // Normalize URL
        const videoId = this._extractVideoId(youtubeUrl);
        if (!videoId) {
            console.error('   ❌ Song DL: Could not extract video ID from:', youtubeUrl);
            return null;
        }

        const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // Primary: ytdl-core
        try {
            const result = await this._downloadViaYtdl(fullUrl, videoId);
            if (result) return result;
        } catch (e) {
            console.error(`   ⚠️ ytdl-core failed: ${e.message}`);
        }

        // Fallback: Invidious
        try {
            const result = await this._downloadViaInvidious(videoId);
            if (result) return result;
        } catch (e) {
            console.error(`   ⚠️ Invidious fallback failed: ${e.message}`);
        }

        console.error('   ❌ All download methods failed');
        return null;
    }

    /**
     * Download via @distube/ytdl-core (most reliable)
     */
    async _downloadViaYtdl(url, videoId) {
        // Get video info first to check duration
        const info = await ytdl.getInfo(url);

        const durationSec = parseInt(info.videoDetails.lengthSeconds || '0');
        if (durationSec > this.MAX_DURATION_SEC) {
            console.log(`   ⚠️ Song too long (${durationSec}s > ${this.MAX_DURATION_SEC}s), skipping`);
            return null;
        }

        const title = info.videoDetails.title || 'song';
        console.log(`   🎶 Downloading: "${title}" (${this._formatDuration(durationSec)})`);

        // Get audio-only format (best quality that fits under 16MB)
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');

        if (audioFormats.length === 0) {
            console.error('   ❌ No audio formats available');
            return null;
        }

        // Sort by audio quality (bitrate), pick best that's likely under 16MB
        const sorted = audioFormats
            .filter(f => f.contentLength && parseInt(f.contentLength) < this.MAX_FILE_SIZE)
            .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

        // If no format with known size under 16MB, try the lowest quality one
        const format = sorted.length > 0
            ? sorted[0]
            : audioFormats.sort((a, b) => (a.audioBitrate || 0) - (b.audioBitrate || 0))[0];

        console.log(`   🎶 Format: ${format.mimeType?.split(';')[0] || 'audio'} @ ${format.audioBitrate || '?'}kbps`);

        // Download to buffer
        const buffer = await this._streamToBuffer(ytdl(url, { format }));

        if (!buffer || buffer.length < 1000) {
            console.error('   ❌ Downloaded buffer too small');
            return null;
        }

        if (buffer.length > this.MAX_FILE_SIZE) {
            console.error(`   ❌ File too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
            return null;
        }

        const mimetype = format.mimeType?.split(';')[0] || 'audio/webm';
        const ext = mimetype.includes('mp4') ? 'mp4' : mimetype.includes('webm') ? 'webm' : 'mp3';

        console.log(`   ✅ Downloaded: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);

        return {
            buffer,
            mimetype,
            filename: `${this._sanitizeFilename(title)}.${ext}`,
            source: 'ytdl-core',
            title
        };
    }

    /**
     * Fallback: Download via Invidious API
     */
    async _downloadViaInvidious(videoId) {
        for (const instance of this.INVIDIOUS_INSTANCES) {
            try {
                const infoResp = await fetch(`${instance}/api/v1/videos/${videoId}`, {
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(10000)
                });

                if (!infoResp.ok) continue;
                const videoInfo = await infoResp.json();

                if (videoInfo.lengthSeconds > this.MAX_DURATION_SEC) {
                    console.log(`   ⚠️ Song too long via Invidious, skipping`);
                    return null;
                }

                // Find audio streams
                const audioStreams = (videoInfo.adaptiveFormats || [])
                    .filter(f => f.type && f.type.includes('audio'))
                    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

                if (audioStreams.length === 0) continue;

                const bestAudio = audioStreams[0];
                if (!bestAudio.url) continue;

                const buffer = await this._downloadUrlToBuffer(bestAudio.url);
                if (buffer && buffer.length > 1000 && buffer.length < this.MAX_FILE_SIZE) {
                    console.log(`   ✅ Invidious audio: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
                    return {
                        buffer,
                        mimetype: bestAudio.type?.split(';')[0] || 'audio/webm',
                        filename: `song_${videoId}.webm`,
                        source: 'invidious'
                    };
                }
            } catch (error) {
                console.error(`   ⚠️ Invidious ${instance}: ${error.message}`);
                continue;
            }
        }
        return null;
    }

    /**
     * Convert a readable stream to a Buffer
     */
    _streamToBuffer(stream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            let totalSize = 0;
            const timeout = setTimeout(() => {
                stream.destroy();
                reject(new Error('Stream timeout'));
            }, 60000); // 60s timeout

            stream.on('data', (chunk) => {
                totalSize += chunk.length;
                if (totalSize > this.MAX_FILE_SIZE) {
                    stream.destroy();
                    clearTimeout(timeout);
                    reject(new Error('File too large'));
                    return;
                }
                chunks.push(chunk);
            });

            stream.on('end', () => {
                clearTimeout(timeout);
                resolve(Buffer.concat(chunks));
            });

            stream.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    /**
     * Download a URL to buffer (for Invidious fallback)
     */
    _downloadUrlToBuffer(url) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Download timeout')), 30000);

            const handler = (response) => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    const protocol = response.headers.location.startsWith('https') ? https : http;
                    protocol.get(response.headers.location, handler).on('error', reject);
                    return;
                }
                if (response.statusCode !== 200) {
                    clearTimeout(timeout);
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }

                const chunks = [];
                let totalSize = 0;
                response.on('data', (chunk) => {
                    totalSize += chunk.length;
                    if (totalSize > this.MAX_FILE_SIZE) {
                        response.destroy();
                        clearTimeout(timeout);
                        reject(new Error('File too large'));
                        return;
                    }
                    chunks.push(chunk);
                });
                response.on('end', () => {
                    clearTimeout(timeout);
                    resolve(Buffer.concat(chunks));
                });
                response.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
            };

            const protocol = url.startsWith('https') ? https : http;
            protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, handler)
                .on('error', (err) => { clearTimeout(timeout); reject(err); });
        });
    }

    /**
     * Extract YouTube video ID
     */
    _extractVideoId(url) {
        if (!url) return null;
        if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
        const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (short) return short[1];
        const long = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (long) return long[1];
        const embed = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
        if (embed) return embed[1];
        return null;
    }

    _formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    _sanitizeFilename(name) {
        return name.replace(/[^a-zA-Z0-9\s-]/g, '').substring(0, 60).trim();
    }
}

module.exports = new SongDownloader();
