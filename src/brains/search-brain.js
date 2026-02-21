/**
 * Search Brain
 * Real-time web search using DuckDuckGo
 * No API key needed — uses DuckDuckGo's instant answer + HTML search
 * 
 * Capabilities:
 * - Instant answers (facts, definitions, calculations)
 * - Web search results with snippets
 * - Smart result summarization
 */

const config = require('../utils/config-loader');
const formatter = require('../engines/formatter');

class SearchBrain {
    constructor() {
        this.DDG_API = 'https://api.duckduckgo.com/';
        this.DDG_HTML = 'https://html.duckduckgo.com/html/';
        this.cache = new Map(); // Simple in-memory cache
        this.CACHE_TTL = 10 * 60 * 1000; // 10 minutes

        console.log('🔍 Search Brain initialized (DuckDuckGo)');
    }

    /**
     * Process a search request
     * @param {string} query - The user's search query
     * @param {Object} intent - Intent analysis result
     * @param {boolean} isGroup - Whether in a group chat
     * @returns {{ response: string, source: string, isQuickResponse: boolean, searchResults: Array }}
     */
    async process(query, intent, isGroup = false) {
        // Clean the query for search
        const cleanQuery = this._cleanQuery(query);

        if (!cleanQuery || cleanQuery.length < 3) {
            return null;
        }

        // Check cache first
        const cached = this._getCache(cleanQuery);
        if (cached) {
            console.log(`   🔍 Search: Cache hit for "${cleanQuery}"`);
            return cached;
        }

        try {
            // Try instant answer first (fast, structured)
            const instantResult = await this._getInstantAnswer(cleanQuery);
            if (instantResult) {
                const result = {
                    response: this._formatInstantAnswer(instantResult, isGroup),
                    source: 'search-brain/instant',
                    isQuickResponse: true,
                    searchResults: [instantResult]
                };
                this._setCache(cleanQuery, result);
                return result;
            }

            // Fall back to HTML search (scrape results)
            const searchResults = await this._htmlSearch(cleanQuery);
            if (searchResults && searchResults.length > 0) {
                const result = {
                    response: this._formatSearchResults(searchResults, cleanQuery, isGroup),
                    source: 'search-brain/web',
                    isQuickResponse: false,
                    searchResults
                };
                this._setCache(cleanQuery, result);
                return result;
            }

            // Both methods failed — still give user a Google link
            const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`;
            return {
                response: `couldn't search that rn, but u can try here: ${googleUrl}`,
                source: 'search-brain/link',
                isQuickResponse: true
            };

        } catch (error) {
            console.error(`   ❌ Search Brain error: ${error.message}`);
            // Even on error, give user a Google link
            const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`;
            return {
                response: `search hit a snag, try this: ${googleUrl}`,
                source: 'search-brain/link',
                isQuickResponse: true
            };
        }
    }

    /**
     * DuckDuckGo Instant Answer API
     * Great for facts, definitions, calculations
     */
    async _getInstantAnswer(query) {
        const params = new URLSearchParams({
            q: query,
            format: 'json',
            no_html: '1',
            skip_disambig: '1',
            no_redirect: '1'
        });

        const response = await fetch(`${this.DDG_API}?${params}`, {
            headers: { 'User-Agent': 'ManthanBot/4.0' },
            signal: AbortSignal.timeout(8000)
        });

        const data = await response.json();

        // Check for abstract (main answer)
        if (data.Abstract && data.Abstract.length > 20) {
            return {
                type: 'abstract',
                title: data.Heading || query,
                text: data.Abstract,
                source: data.AbstractSource || 'Web',
                url: data.AbstractURL || '',
                image: data.Image || ''
            };
        }

        // Check for answer (calculations, conversions)
        if (data.Answer && data.Answer.length > 0) {
            return {
                type: 'answer',
                title: query,
                text: data.Answer,
                source: 'DuckDuckGo',
                url: ''
            };
        }

        // Check for definition
        if (data.Definition && data.Definition.length > 0) {
            return {
                type: 'definition',
                title: data.Heading || query,
                text: data.Definition,
                source: data.DefinitionSource || 'Web',
                url: data.DefinitionURL || ''
            };
        }

        // Check for related topics
        if (data.RelatedTopics && data.RelatedTopics.length > 0) {
            const topics = data.RelatedTopics
                .filter(t => t.Text)
                .slice(0, 3);

            if (topics.length > 0) {
                return {
                    type: 'related',
                    title: query,
                    text: topics.map(t => t.Text).join('\n'),
                    source: 'DuckDuckGo',
                    topics: topics
                };
            }
        }

        return null;
    }

    /**
     * DuckDuckGo HTML Search (scrape text results)
     * Fallback when instant answer doesn't have results
     */
    async _htmlSearch(query) {
        try {
            const params = new URLSearchParams({
                q: query,
                kl: 'wt-wt' // No region bias
            });

            const response = await fetch(`${this.DDG_HTML}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                body: params.toString(),
                signal: AbortSignal.timeout(10000)
            });

            const html = await response.text();

            // Parse results from HTML
            const results = this._parseHtmlResults(html);
            return results;

        } catch (error) {
            console.error(`   ❌ HTML Search error: ${error.message}`);
            return [];
        }
    }

    /**
     * Parse search results from DuckDuckGo HTML
     */
    _parseHtmlResults(html) {
        const results = [];

        // Extract result blocks using regex (simple approach without DOM parser)
        const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gi;

        let match;
        while ((match = resultPattern.exec(html)) !== null && results.length < 5) {
            let url = match[1];

            // Skip DuckDuckGo ads (/y.js?...)
            if (url.includes('/y.js')) continue;

            // Handle protocol-relative URLs
            if (url.startsWith('//')) url = 'https:' + url;

            // Decode internal DDG redirects
            url = this._decodeRedirectUrl(url);

            const title = this._stripHtml(match[2]);
            const snippet = this._stripHtml(match[3]);

            if (title && snippet && url.startsWith('http')) {
                results.push({ title, snippet, url });
            }
        }

        // Fallback: simpler pattern
        if (results.length === 0) {
            const snippetPattern = /<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gi;
            let sMatch;
            while ((sMatch = snippetPattern.exec(html)) !== null && results.length < 3) {
                const snippet = this._stripHtml(sMatch[1]);
                if (snippet && snippet.length > 30) {
                    results.push({ title: '', snippet, url: '' });
                }
            }
        }

        return results;
    }

    /**
     * Format instant answer for WhatsApp
     */
    _formatInstantAnswer(result, isGroup) {
        return formatter.formatInstantAnswer(result, isGroup);
    }

    /**
     * Format web search results for WhatsApp
     */
    _formatSearchResults(results, query, isGroup) {
        return formatter.formatSearchResults(results, query, isGroup);
    }

    /**
     * Clean user query for search
     */
    _cleanQuery(message) {
        let query = message;

        // Remove common bot addressing patterns
        query = query.replace(/(manthan|bot|bro|dude|bhai|yaar)\s*/gi, '');
        query = query.replace(/(search|google|look up|find|what is|what's|tell me about|explain)/gi, '');
        query = query.replace(/(please|pls|can you|could you|will you)/gi, '');

        // Clean up
        query = query.replace(/[?!.]+/g, '').trim();

        return query;
    }

    /**
     * Check if a message is a search request
     */
    isSearchRequest(message, intent) {
        const msg = message.toLowerCase();

        // Explicit search commands
        if (/^(search|google|look up|find)\s+/i.test(msg)) return true;

        // Questions that need web search (not personal KB)
        if (intent?.primary === 'question' && intent?.subIntent === 'factual') {
            // Check if it's NOT about Manthan (handled by knowledge brain)
            if (!/manthan|your|you|tum|aap/i.test(msg)) return true;
        }

        // Current events / news
        if (/(latest|news|current|today|recent|trending|what happened)/i.test(msg)) return true;

        // Technical questions
        if (/(how to|how do|what is|what are|define|meaning of|difference between)/i.test(msg)) {
            if (!/manthan|your|you/i.test(msg)) return true;
        }

        return false;
    }

    // ─── Utility Methods ─────────────────

    _stripHtml(html) {
        return html
            .replace(/<[^>]*>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    _decodeRedirectUrl(url) {
        try {
            if (url.includes('uddg=')) {
                const decoded = decodeURIComponent(url.split('uddg=')[1].split('&')[0]);
                return decoded;
            }
            return url;
        } catch {
            return url;
        }
    }

    _getCache(key) {
        const entry = this.cache.get(key);
        if (entry && Date.now() - entry.timestamp < this.CACHE_TTL) {
            return entry.data;
        }
        this.cache.delete(key);
        return null;
    }

    _setCache(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
        // Limit cache size
        if (this.cache.size > 100) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }
}

module.exports = new SearchBrain();
