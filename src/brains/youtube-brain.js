/**
 * YouTube Brain
 * Search and recommend YouTube videos
 * Uses YouTube Data API v3 (with key) or Invidious API (no key fallback)
 * 
 * Capabilities:
 * - Search videos by query
 * - Get video details (title, views, duration)
 * - Format recommendations with short explanations
 * - Detect YouTube-related queries
 */

const formatter = require('../engines/formatter');

class YouTubeBrain {
    constructor() {
        this.apiKey = process.env.YOUTUBE_API_KEY || null;
        this.YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
        // Invidious instances as fallback (no API key needed)
        this.INVIDIOUS_INSTANCES = [
            'https://vid.puffyan.us',
            'https://invidious.snopyta.org',
            'https://yewtu.be',
            'https://inv.nadeko.net'
        ];
        this.cache = new Map();
        this.CACHE_TTL = 30 * 60 * 1000; // 30 minutes

        console.log(`📹 YouTube Brain initialized ${this.apiKey ? '(API Key ✓)' : '(Invidious fallback)'}`);
    }

    /**
     * Process a YouTube search request
     * @param {string} query - Search query
     * @param {boolean} isGroup - Group context
     * @returns {{ response: string, source: string, videos: Array }}
     */
    async process(query, isGroup = false) {
        const cleanQuery = this._cleanQuery(query);

        if (!cleanQuery || cleanQuery.length < 2) return null;

        // Cache check
        const cached = this._getCache(cleanQuery);
        if (cached) {
            console.log(`   📹 YouTube: Cache hit for "${cleanQuery}"`);
            return cached;
        }

        try {
            let videos;

            if (this.apiKey) {
                videos = await this._searchYouTubeAPI(cleanQuery);
            }

            if (!videos || videos.length === 0) {
                videos = await this._searchInvidious(cleanQuery);
            }

            if (!videos || videos.length === 0) {
                // Always give the user a direct YouTube search link
                const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
                return {
                    response: `couldn't pull specific videos rn, but here's the direct search 🔍\n\n🔗 ${searchUrl}`,
                    source: 'youtube-brain/link',
                    isQuickResponse: true
                };
            }

            const result = {
                response: this._formatResults(videos, cleanQuery, isGroup),
                source: 'youtube-brain',
                isQuickResponse: false,
                videos
            };

            this._setCache(cleanQuery, result);
            return result;

        } catch (error) {
            console.error(`   ❌ YouTube Brain error: ${error.message}`);
            return null;
        }
    }

    /**
     * YouTube Data API v3 search
     */
    async _searchYouTubeAPI(query) {
        const params = new URLSearchParams({
            part: 'snippet',
            q: query,
            type: 'video',
            maxResults: '5',
            key: this.apiKey,
            relevanceLanguage: 'en',
            safeSearch: 'moderate'
        });

        const response = await fetch(`${this.YOUTUBE_API}/search?${params}`, {
            signal: AbortSignal.timeout(8000)
        });

        if (!response.ok) {
            throw new Error(`YouTube API: ${response.status}`);
        }

        const data = await response.json();

        if (!data.items || data.items.length === 0) return [];

        return data.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            description: item.snippet.description?.substring(0, 150) || '',
            thumbnail: item.snippet.thumbnails?.default?.url || '',
            url: `https://youtu.be/${item.id.videoId}`,
            publishedAt: item.snippet.publishedAt
        }));
    }

    /**
     * Invidious API search (no key needed)
     */
    async _searchInvidious(query) {
        for (const instance of this.INVIDIOUS_INSTANCES) {
            try {
                const params = new URLSearchParams({
                    q: query,
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

                return data.slice(0, 5).map(item => ({
                    id: item.videoId,
                    title: item.title,
                    channel: item.author || item.authorId || 'Unknown',
                    description: item.description?.substring(0, 150) || '',
                    url: `https://youtu.be/${item.videoId}`,
                    views: item.viewCount || 0,
                    duration: this._formatDuration(item.lengthSeconds || 0),
                    publishedAt: item.publishedText || ''
                }));

            } catch (error) {
                console.error(`   ⚠️ Invidious ${instance} failed: ${error.message}`);
                continue;
            }
        }

        return [];
    }

    /**
     * Format results for WhatsApp message
     */
    _formatResults(videos, query, isGroup) {
        return formatter.formatYouTubeResults(videos, query, isGroup);
    }

    /**
     * Check if a message is a YouTube request
     */
    isYouTubeRequest(message) {
        const msg = message.toLowerCase();
        return (
            /\b(youtube|yt|video|videos|watch|recommend|suggest)\b/i.test(msg) &&
            !/\b(my channel|my youtube|@3manthan)\b/i.test(msg) // Exclude self-references
        );
    }

    /**
     * Clean query for YouTube search
     */
    _cleanQuery(message) {
        let query = message;

        // Remove common bot patterns
        query = query.replace(/(manthan|bot|bro|bhai|yaar|dude)\s*/gi, '');
        query = query.replace(/(search|find|show|recommend|suggest|play)\s*(me\s*)?(a\s*)?(youtube\s*)?(video|videos|vid|yt)?\s*(on|for|about|of)?\s*/gi, '');
        query = query.replace(/(can you|could you|please|pls)\s*/gi, '');
        query = query.replace(/[?!.]+$/g, '');

        return query.trim();
    }

    // ─── Utility Methods ─────────────────

    _formatDuration(seconds) {
        if (!seconds) return '';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    _formatViews(views) {
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
        const entry = this.cache.get(key);
        if (entry && Date.now() - entry.timestamp < this.CACHE_TTL) return entry.data;
        this.cache.delete(key);
        return null;
    }

    _setCache(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
        if (this.cache.size > 50) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }
}

module.exports = new YouTubeBrain();
