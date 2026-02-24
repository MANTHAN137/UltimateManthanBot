/**
 * YouTube Brain v2.0
 * Search and recommend YouTube videos with improved relevance
 * Uses YouTube Data API v3 (with key) or Invidious API (no key fallback)
 * 
 * Improvements over v1:
 *   - Region-targeted search (India) for better local relevance
 *   - Video statistics enrichment (views, likes) via API for relevance ranking
 *   - Smart query enhancement — detects language (Hindi/English) and adds context
 *   - Better Invidious instance list (updated, working instances)
 *   - Relevance scoring to rank results better
 *   - Shows top 5 results in DMs, top 1 in groups
 * 
 * IMPORTANT: Only triggers when user explicitly mentions "youtube", "yt", or "video(s)"
 */

const formatter = require('../engines/formatter');

class YouTubeBrain {
    constructor() {
        this.apiKey = process.env.YOUTUBE_API_KEY || null;
        this.YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
        this.INVIDIOUS_INSTANCES = [
            'https://inv.nadeko.net',
            'https://invidious.nerdvpn.de',
            'https://invidious.jing.rocks',
            'https://yewtu.be',
            'https://inv.tux.pizza',
            'https://invidious.privacyredirect.com'
        ];
        this.cache = new Map();
        this.CACHE_TTL = 30 * 60 * 1000; // 30 minutes

        console.log(`📹 YouTube Brain v2.0 initialized ${this.apiKey ? '(API Key ✓)' : '(Invidious fallback)'}`);
    }

    /**
     * Process a YouTube search request
     */
    async process(query, isGroup = false) {
        const cleanQuery = this._cleanQuery(query);

        if (!cleanQuery || cleanQuery.length < 2) return null;

        const cached = this._getCache(cleanQuery);
        if (cached) {
            console.log(`   📹 YouTube: Cache hit for "${cleanQuery}"`);
            return cached;
        }

        try {
            let videos;

            if (this.apiKey) {
                videos = await this._searchYouTubeAPI(cleanQuery);

                // Enrich with statistics (views, likes) for better relevance
                if (videos && videos.length > 0) {
                    videos = await this._enrichWithStats(videos);
                }
            }

            if (!videos || videos.length === 0) {
                videos = await this._searchInvidious(cleanQuery);
            }

            if (!videos || videos.length === 0) {
                const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
                return {
                    response: `couldn't pull specific videos rn yarr, but try searching here: ${searchUrl}`,
                    source: 'youtube-brain/link',
                    isQuickResponse: true
                };
            }

            // Rank videos by relevance score
            videos = this._rankByRelevance(videos, cleanQuery);

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
     * YouTube Data API v3 search — improved with region targeting
     */
    async _searchYouTubeAPI(query) {
        const enhancedQuery = this._enhanceQuery(query);

        const params = new URLSearchParams({
            part: 'snippet',
            q: enhancedQuery,
            type: 'video',
            maxResults: '8',         // Fetch more, then rank and pick top 5
            key: this.apiKey,
            regionCode: 'IN',        // Target India for local relevance
            relevanceLanguage: 'en', // English + Hindi content
            safeSearch: 'moderate',
            order: 'relevance',
            videoEmbeddable: 'true'  // Only embeddable (real) videos
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
            title: this._decodeHtml(item.snippet.title),
            channel: item.snippet.channelTitle,
            description: item.snippet.description?.substring(0, 200) || '',
            thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
            url: `https://youtu.be/${item.id.videoId}`,
            publishedAt: item.snippet.publishedAt,
            liveBroadcastContent: item.snippet.liveBroadcastContent || 'none'
        }));
    }

    /**
     * Enrich videos with statistics (views, likes, duration) from YouTube API
     * This allows better relevance ranking
     */
    async _enrichWithStats(videos) {
        if (!this.apiKey || videos.length === 0) return videos;

        try {
            const videoIds = videos.map(v => v.id).join(',');
            const params = new URLSearchParams({
                part: 'statistics,contentDetails',
                id: videoIds,
                key: this.apiKey
            });

            const response = await fetch(`${this.YOUTUBE_API}/videos?${params}`, {
                signal: AbortSignal.timeout(6000)
            });

            if (!response.ok) return videos;

            const data = await response.json();
            if (!data.items) return videos;

            // Map stats back to videos
            const statsMap = new Map();
            for (const item of data.items) {
                statsMap.set(item.id, {
                    views: parseInt(item.statistics?.viewCount || '0'),
                    likes: parseInt(item.statistics?.likeCount || '0'),
                    comments: parseInt(item.statistics?.commentCount || '0'),
                    duration: this._parseISO8601Duration(item.contentDetails?.duration || '')
                });
            }

            return videos.map(v => {
                const stats = statsMap.get(v.id);
                if (stats) {
                    v.views = stats.views;
                    v.likes = stats.likes;
                    v.comments = stats.comments;
                    v.duration = stats.duration;
                }
                return v;
            });

        } catch (error) {
            console.error(`   ⚠️ Stats enrichment failed: ${error.message}`);
            return videos;
        }
    }

    /**
     * Invidious API search (no key needed) — updated instances
     */
    async _searchInvidious(query) {
        const enhancedQuery = this._enhanceQuery(query);

        for (const instance of this.INVIDIOUS_INSTANCES) {
            try {
                const params = new URLSearchParams({
                    q: enhancedQuery,
                    sort_by: 'relevance',
                    type: 'video',
                    region: 'IN'
                });

                const response = await fetch(`${instance}/api/v1/search?${params}`, {
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(8000)
                });

                if (!response.ok) continue;

                const data = await response.json();

                if (!Array.isArray(data) || data.length === 0) continue;

                return data.slice(0, 8).map(item => ({
                    id: item.videoId,
                    title: item.title,
                    channel: item.author || item.authorId || 'Unknown',
                    description: item.description?.substring(0, 200) || '',
                    url: `https://youtu.be/${item.videoId}`,
                    views: item.viewCount || 0,
                    likes: item.likeCount || 0,
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
     * Rank videos by relevance score
     * Considers: title match, view count, recency, engagement
     */
    _rankByRelevance(videos, query) {
        const queryWords = query.toLowerCase().split(/\s+/);

        const scored = videos.map(v => {
            let score = 0;
            const titleLower = (v.title || '').toLowerCase();

            // Title relevance — how many query words appear in the title
            for (const word of queryWords) {
                if (word.length < 2) continue;
                if (titleLower.includes(word)) score += 15;
            }

            // Exact phrase match in title — big bonus
            if (titleLower.includes(query.toLowerCase())) score += 30;

            // View count — logarithmic scoring (popular = more relevant)
            if (v.views) {
                score += Math.min(Math.log10(v.views + 1) * 3, 25);
            }

            // Engagement ratio (likes/views) — quality signal
            if (v.views && v.likes) {
                const ratio = v.likes / v.views;
                score += ratio * 100; // 5% ratio = +5 points
            }

            // Recency bonus — newer videos get a slight boost
            if (v.publishedAt) {
                const ageMs = Date.now() - new Date(v.publishedAt).getTime();
                const ageDays = ageMs / (1000 * 60 * 60 * 24);
                if (ageDays < 7) score += 10;       // This week
                else if (ageDays < 30) score += 5;  // This month
                else if (ageDays < 365) score += 2; // This year
            }

            // Penalize live streams (usually less relevant for search)
            if (v.liveBroadcastContent === 'live') score -= 10;

            // Penalize very short videos (< 1 min) — often clickbait
            if (v.duration) {
                const durationStr = v.duration;
                if (durationStr === '0:00' || durationStr === '0:01') score -= 15;
            }

            v._relevanceScore = score;
            return v;
        });

        // Sort by relevance score (highest first)
        scored.sort((a, b) => b._relevanceScore - a._relevanceScore);

        // Return top 5
        return scored.slice(0, 5);
    }

    /**
     * Enhance query for better search results
     * Detects Hindi/Hinglish terms and adds context
     */
    _enhanceQuery(query) {
        const q = query.toLowerCase().trim();

        // Don't enhance already specific queries
        if (q.length > 50) return query;

        // Map common short/vague queries to better search terms
        const enhancements = {
            'song': 'official music video',
            'gana': 'official music video hindi',
            'naya gana': 'latest hindi songs',
            'new song': 'latest music video',
            'trailer': 'official trailer',
            'funny': 'funny videos compilation',
            'comedy': 'comedy videos hindi',
            'tutorial': 'tutorial complete guide',
            'how to': 'how to step by step'
        };

        for (const [key, enhancement] of Object.entries(enhancements)) {
            if (q.includes(key) && !q.includes(enhancement.split(' ').pop())) {
                return query + ' ' + enhancement.split(' ').pop();
            }
        }

        return query;
    }

    _formatResults(videos, query, isGroup) {
        return formatter.formatYouTubeResults(videos, query, isGroup);
    }

    /**
     * Check if a message is a YouTube request
     * 
     * STRICT: Only triggers when user explicitly mentions youtube/yt/video(s)
     * AND it's clearly asking for video content, not just mentioning the word
     */
    isYouTubeRequest(message) {
        const msg = message.toLowerCase().trim();

        // Exclude self-references to owner's channel
        if (/\b(my channel|my youtube|@3manthan)\b/i.test(msg)) return false;

        // Explicit YouTube requests: "youtube X", "yt X", "send video of X"
        if (/\b(youtube|yt)\b/i.test(msg)) return true;

        // "video" / "videos" only when asking for content
        // e.g. "send me a video about cooking", "show video on React", "video of cats"
        if (/\b(video|videos)\b/i.test(msg) && /\b(send|show|find|search|play|recommend|suggest|about|on|of|for)\b/i.test(msg)) {
            return true;
        }

        return false;
    }

    _cleanQuery(message) {
        let query = message;
        query = query.replace(/(manthan|bot|bro|bhai|yaar|yarr|dude)\s*/gi, '');
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

    /**
     * Parse ISO 8601 duration (PT1H2M3S) to human readable format
     */
    _parseISO8601Duration(iso) {
        if (!iso) return '';
        const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return '';
        const hrs = parseInt(match[1] || '0');
        const mins = parseInt(match[2] || '0');
        const secs = parseInt(match[3] || '0');
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
