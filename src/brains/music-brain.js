/**
 * Music Brain v3.0
 * Detects music queries, searches for the actual song via Invidious/YouTube,
 * downloads audio and sends it as WhatsApp audio message
 * No API key needed — uses Invidious (free YouTube API alternative)
 */

const songDownloader = require('../engines/song-downloader');

class MusicBrain {
    constructor() {
        this.musicPatterns = [
            /\b(play|song|music|gana|gaana|bajao|sunao|listen)\b/i,
            /\b(singer|artist|album|lyrics|track)\b/i,
            /\b(spotify|jiosaavn|gaana\.com|wynk|youtube music)\b/i
        ];

        this.INVIDIOUS_INSTANCES = [
            'https://vid.puffyan.us',
            'https://invidious.snopyta.org',
            'https://yewtu.be',
            'https://inv.nadeko.net'
        ];

        this.cache = new Map();

        console.log('🎵 Music Brain initialized');
    }

    /**
     * Check if message is a music request
     */
    isMusicRequest(message) {
        const msg = message.toLowerCase();
        const isMusic = this.musicPatterns.some(p => p.test(msg));
        // Must match music pattern but NOT be a YouTube video request
        const isYouTubeVideo = /\b(video|tutorial|how to|review|vlog)\b/i.test(msg);
        return isMusic && !isYouTubeVideo;
    }

    /**
     * Process a music request — actually search for the song
     */
    async process(message, isGroup = false) {
        const query = this._cleanQuery(message);
        if (!query || query.length < 2) return null;

        // Check cache
        const cached = this._getCache(query);
        if (cached) {
            console.log(`   \u{1F3B5} Music: Cache hit for "${query}"`);
            return cached;
        }

        try {
            // Search for the song on YouTube via Invidious
            const song = await this._searchSong(query);

            if (song) {
                const result = {
                    response: this._formatResult(song, query, isGroup),
                    source: 'music-brain',
                    isQuickResponse: true
                };

                // Download audio for the top result
                const topSong = song[0];
                if (topSong && topSong.url) {
                    console.log(`   \u{1F3B5} Attempting audio download for: ${topSong.title}`);
                    try {
                        const audioResult = await songDownloader.downloadAudio(topSong.url);
                        if (audioResult && audioResult.buffer) {
                            result.audioBuffer = audioResult.buffer;
                            result.audioMimetype = audioResult.mimetype || 'audio/mpeg';
                            result.audioFilename = audioResult.filename || `${query}.mp3`;
                            result.hasAudio = true;
                            console.log(`   \u{1F3B5} Audio ready: ${(audioResult.buffer.length / 1024 / 1024).toFixed(2)}MB`);
                        }
                    } catch (dlErr) {
                        console.error(`   \u26A0\uFE0F Audio download failed: ${dlErr.message}`);
                    }
                }

                this._setCache(query, result);
                return result;
            }

            // Fallback: generate search links if API fails
            return this._fallbackLinks(query, isGroup);

        } catch (error) {
            console.error('   \u274C Music Brain error:', error.message);
            return this._fallbackLinks(query, isGroup);
        }
    }

    /**
     * Search for a specific song using Invidious API (no key needed)
     */
    async _searchSong(query) {
        const searchQuery = query + ' official audio';

        for (const instance of this.INVIDIOUS_INSTANCES) {
            try {
                const params = new URLSearchParams({
                    q: searchQuery,
                    sort_by: 'relevance',
                    type: 'video'
                });

                const response = await fetch(`${instance}/api/v1/search?${params}`, {
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(8000)
                });

                if (!response.ok) continue;
                const data = await response.json();

                if (!Array.isArray(data) || data.length === 0) continue;

                // Get top 3 results
                const results = data.slice(0, 3).map(item => ({
                    id: item.videoId,
                    title: item.title,
                    channel: item.author || 'Unknown',
                    url: `https://youtu.be/${item.videoId}`,
                    views: item.viewCount || 0,
                    duration: this._formatDuration(item.lengthSeconds || 0)
                }));

                return results;

            } catch (error) {
                console.error(`   ⚠️ Invidious ${instance} failed: ${error.message}`);
                continue;
            }
        }

        return null;
    }

    /**
     * Format the song result for WhatsApp
     */
    _formatResult(songs, query, isGroup) {
        const encodedQuery = encodeURIComponent(query);
        const top = songs[0];

        if (isGroup) {
            return `🎵 *${this._decodeHtml(top.title)}*\n📺 ${top.channel} | ⏱️ ${top.duration}\n▶️ ${top.url}`;
        }

        let msg = `🎵 *Music: ${query}*\n\n`;

        // Show top results with direct links
        songs.forEach((s, i) => {
            msg += `${i + 1}. *${this._decodeHtml(s.title)}*\n`;
            msg += `   📺 ${s.channel}`;
            if (s.duration) msg += ` | ⏱️ ${s.duration}`;
            if (s.views) msg += ` | 👁️ ${this._formatViews(s.views)}`;
            msg += `\n   ▶️ ${s.url}\n\n`;
        });

        // Add platform links
        msg += `───── _More Platforms_ ─────\n`;
        msg += `🟢 Spotify: https://open.spotify.com/search/${encodedQuery}\n`;
        msg += `🎶 JioSaavn: https://www.jiosaavn.com/search/${encodedQuery}\n`;
        msg += `🎧 YT Music: https://music.youtube.com/search?q=${encodedQuery}`;

        return msg;
    }

    /**
     * Fallback: just send search links when API fails
     */
    _fallbackLinks(query, isGroup) {
        const encodedQuery = encodeURIComponent(query);
        const ytLink = `https://www.youtube.com/results?search_query=${encodedQuery}+official+audio`;
        const spotifyLink = `https://open.spotify.com/search/${encodedQuery}`;

        const response = isGroup
            ? `🎵 *${query}*\n▶️ ${ytLink}\n🟢 ${spotifyLink}`
            : `🎵 *Music: ${query}*\n\n▶️ *YouTube:* ${ytLink}\n🟢 *Spotify:* ${spotifyLink}\n🎶 *JioSaavn:* https://www.jiosaavn.com/search/${encodedQuery}\n🎧 *YT Music:* https://music.youtube.com/search?q=${encodedQuery}`;

        return {
            response,
            source: 'music-brain/fallback',
            isQuickResponse: true
        };
    }

    /**
     * Clean query for music search
     */
    _cleanQuery(message) {
        return message
            .replace(/\b(play|song|music|gana|gaana|bajao|sunao|listen|find|search|put on|baja|bajao|singer|artist|album|lyrics|track|spotify|jiosaavn|youtube music|please|pls|plz|can you|could you|mujhe|mera|mere|liye|the|a|an)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    _formatDuration(seconds) {
        if (!seconds) return '';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    _formatViews(views) {
        if (views >= 1000000000) return `${(views / 1000000000).toFixed(1)}B`;
        if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
        if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
        return views.toString();
    }

    _decodeHtml(text) {
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#x27;/g, "'");
    }

    _getCache(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() - item.time > 1800000) { // 30 min cache
            this.cache.delete(key);
            return null;
        }
        return item.data;
    }

    _setCache(key, data) {
        if (this.cache.size > 50) {
            const oldest = this.cache.keys().next().value;
            this.cache.delete(oldest);
        }
        this.cache.set(key, { data, time: Date.now() });
    }
}

module.exports = new MusicBrain();
