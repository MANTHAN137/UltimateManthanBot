/**
 * Link Preview Brain
 * Fetches page title/description when someone sends a URL
 * No API key needed — uses native fetch + HTML parsing
 */

class LinkBrain {
    constructor() {
        this.urlPattern = /https?:\/\/[^\s]+/gi;
        this.cache = new Map();
        console.log('🔗 Link Preview Brain initialized');
    }

    /**
     * Check if message contains a URL
     */
    hasLink(message) {
        this.urlPattern.lastIndex = 0;
        return this.urlPattern.test(message);
    }

    /**
     * Extract URLs from message
     */
    extractUrls(message) {
        const matches = message.match(/https?:\/\/[^\s]+/gi);
        return matches || [];
    }

    /**
     * Process a message with links
     */
    async process(message, isGroup = false) {
        const urls = this.extractUrls(message);
        if (urls.length === 0) return null;

        const url = urls[0]; // Process first URL

        // Check cache
        const cached = this._getCache(url);
        if (cached) {
            return {
                response: cached,
                source: 'link-brain/cache',
                isQuickResponse: true
            };
        }

        try {
            const preview = await this._fetchPreview(url);
            if (!preview) return null;

            const response = this._formatPreview(preview, url, isGroup);
            this._setCache(url, response);

            return {
                response,
                source: 'link-brain',
                isQuickResponse: true
            };
        } catch (error) {
            console.error('   ❌ Link preview error:', error.message);
            return null;
        }
    }

    /**
     * Fetch page title and description
     */
    async _fetchPreview(url) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ManthanBot/1.0)',
                    'Accept': 'text/html'
                },
                signal: AbortSignal.timeout(8000),
                redirect: 'follow'
            });

            if (!response.ok) return null;

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('text/html')) {
                // Non-HTML content
                return {
                    title: this._getDomainName(url),
                    description: `📄 ${contentType.split(';')[0]} file`,
                    domain: this._getDomainName(url)
                };
            }

            // Read first 10KB for meta tags
            const reader = response.body.getReader();
            let text = '';
            const decoder = new TextDecoder();

            while (text.length < 10000) {
                const { done, value } = await reader.read();
                if (done) break;
                text += decoder.decode(value, { stream: true });
            }
            reader.cancel();

            const title = this._extractTitle(text);
            const description = this._extractDescription(text);
            const domain = this._getDomainName(url);

            if (!title && !description) return null;

            return { title, description, domain };
        } catch (error) {
            return null;
        }
    }

    _extractTitle(html) {
        // Try og:title first
        const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
        if (ogTitle) return this._decodeHtml(ogTitle[1]).slice(0, 100);

        // Fallback to <title>
        const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleTag) return this._decodeHtml(titleTag[1]).slice(0, 100);

        return null;
    }

    _extractDescription(html) {
        // Try og:description
        const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
        if (ogDesc) return this._decodeHtml(ogDesc[1]).slice(0, 200);

        // Fallback to meta description
        const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
        if (metaDesc) return this._decodeHtml(metaDesc[1]).slice(0, 200);

        return null;
    }

    _getDomainName(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return 'unknown';
        }
    }

    _formatPreview(preview, url, isGroup) {
        if (isGroup) {
            return `🔗 *${preview.title || preview.domain}*${preview.description ? '\n' + preview.description.slice(0, 80) + '...' : ''}`;
        }

        let msg = `🔗 *Link Preview*\n`;
        if (preview.title) msg += `📌 *${preview.title}*\n`;
        if (preview.description) msg += `📝 ${preview.description}\n`;
        msg += `🌐 ${preview.domain}`;
        return msg;
    }

    _decodeHtml(text) {
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&#x27;/g, "'")
            .replace(/&#x2F;/g, '/')
            .replace(/&nbsp;/g, ' ')
            .trim();
    }

    _getCache(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() - item.time > 3600000) { // 1 hour
            this.cache.delete(key);
            return null;
        }
        return item.data;
    }

    _setCache(key, data) {
        if (this.cache.size > 100) {
            const oldest = this.cache.keys().next().value;
            this.cache.delete(oldest);
        }
        this.cache.set(key, { data, time: Date.now() });
    }
}

module.exports = new LinkBrain();
