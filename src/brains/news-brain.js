/**
 * News Brain
 * Fetches trending news using Google News RSS feed
 * No API key required
 */

const formatter = require('../engines/formatter');

class NewsBrain {
    constructor() {
        this.GOOGLE_NEWS_RSS = 'https://news.google.com/rss';
        this.cache = new Map();
        this.CACHE_TTL = 15 * 60 * 1000; // 15 minutes
        console.log('📰 News Brain initialized (Google News RSS)');
    }

    /**
     * Process a news request
     */
    async process(query, isGroup = false) {
        const topic = this._extractTopic(query);
        const cacheKey = topic || '__top__';

        const cached = this._getCache(cacheKey);
        if (cached) {
            console.log(`   📰 News: Cache hit for "${cacheKey}"`);
            return cached;
        }

        try {
            const articles = await this._fetchNews(topic);

            if (!articles || articles.length === 0) {
                return {
                    response: `couldn't fetch news rn 😅 try here: https://news.google.com`,
                    source: 'news-brain/fallback',
                    isQuickResponse: true
                };
            }

            const result = {
                response: formatter.formatNews(articles, topic, isGroup),
                source: 'news-brain',
                isQuickResponse: false,
                articles
            };

            this._setCache(cacheKey, result);
            return result;

        } catch (error) {
            console.error(`   ❌ News Brain error: ${error.message}`);
            return {
                response: `news fetch failed, check here: https://news.google.com${topic ? '/search?q=' + encodeURIComponent(topic) : ''}`,
                source: 'news-brain/fallback',
                isQuickResponse: true
            };
        }
    }

    /**
     * Fetch news from Google News RSS
     */
    async _fetchNews(topic = '') {
        let url = this.GOOGLE_NEWS_RSS;
        if (topic) {
            url += `/search?q=${encodeURIComponent(topic)}&hl=en-IN&gl=IN&ceid=IN:en`;
        } else {
            url += `?hl=en-IN&gl=IN&ceid=IN:en`;
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: AbortSignal.timeout(10000)
        });

        const xml = await response.text();
        return this._parseRSS(xml);
    }

    /**
     * Parse RSS XML into articles
     */
    _parseRSS(xml) {
        const articles = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
        let match;

        while ((match = itemRegex.exec(xml)) !== null && articles.length < 8) {
            const item = match[1];

            const title = this._extractTag(item, 'title');
            const link = this._extractTag(item, 'link');
            const pubDate = this._extractTag(item, 'pubDate');
            const source = this._extractTag(item, 'source');

            if (title) {
                articles.push({
                    title: this._decodeHtml(title),
                    link: link || '',
                    pubDate: pubDate || '',
                    source: source ? this._decodeHtml(source) : ''
                });
            }
        }

        return articles;
    }

    /**
     * Extract content from an XML tag
     */
    _extractTag(xml, tagName) {
        const regex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>|<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
        const match = xml.match(regex);
        if (match) return (match[1] || match[2] || '').trim();
        return '';
    }

    /**
     * Check if message is a news request
     */
    isNewsRequest(message) {
        const msg = message.toLowerCase();
        return /\b(news|headlines|trending|what'?s happening|current events|latest updates|khabar|samachar)\b/i.test(msg) &&
            !/\b(fake news|old news|no news|bad news|good news)\b/i.test(msg);
    }

    /**
     * Extract topic from news query
     */
    _extractTopic(message) {
        let query = message.toLowerCase();
        query = query.replace(/(news|headlines|trending|latest|show me|tell me|get|fetch|what'?s happening in|about)/gi, '');
        query = query.replace(/(please|pls|can you|could you|manthan|bot|bro|bhai)/gi, '');
        query = query.replace(/[?!.]+/g, '').trim();
        return query.length > 2 ? query : '';
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
        if (this.cache.size > 20) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }
}

module.exports = new NewsBrain();
