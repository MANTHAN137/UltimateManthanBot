/**
 * Formatter Engine
 * Professional, clean formatting for all WhatsApp bot outputs
 * Uses WhatsApp markdown: *bold*, _italic_, ```monospace```, ~strikethrough~
 */

class Formatter {
    constructor() {
        this.SEPARATOR = '━━━━━━━━━━━━━━━━━━━━';
        this.THIN_SEP = '─────────────────────';
        console.log('🎨 Formatter Engine initialized');
    }

    // ═══════════════════════════════════════
    // SEARCH RESULTS
    // ═══════════════════════════════════════

    /**
     * Format instant answer (definition, fact, calculation)
     */
    formatInstantAnswer(result, isGroup = false) {
        if (isGroup) {
            const text = result.text.length > 150
                ? result.text.substring(0, 147) + '...'
                : result.text;
            return `💡 ${text}${result.url ? '\n🔗 ' + this._cleanUrl(result.url) : ''}`;
        }

        let msg = '';

        if (result.type === 'answer') {
            msg = `💡 *Quick Answer*\n\n${result.text}`;
        } else if (result.type === 'definition') {
            msg = `📖 *${result.title}*\n\n${result.text}`;
        } else {
            const text = result.text.length > 300
                ? result.text.substring(0, 297) + '...'
                : result.text;
            msg = `📋 *${result.title || 'Result'}*\n\n${text}`;
        }

        if (result.url) {
            msg += `\n\n🔗 *Source:* ${this._cleanUrl(result.url)}`;
        }

        return msg;
    }

    /**
     * Format web search results
     */
    formatSearchResults(results, query, isGroup = false) {
        if (!results || results.length === 0) return null;

        if (isGroup) {
            const top = results[0];
            return `🔍 ${top.snippet}${top.url ? '\n🔗 ' + this._cleanUrl(top.url) : ''}`;
        }

        let msg = `🔍 *Search Results for "${query}"*\n${this.THIN_SEP}\n`;

        const topResults = results.slice(0, 3);
        topResults.forEach((r, i) => {
            msg += `\n*${i + 1}.* ${r.title ? `*${r.title}*\n` : ''}`;
            msg += `   ${r.snippet}`;
            if (r.url) msg += `\n   🔗 ${this._cleanUrl(r.url)}`;
            if (i < topResults.length - 1) msg += '\n';
        });

        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        msg += `\n\n${this.THIN_SEP}\n🌐 *More:* ${googleUrl}`;

        return msg;
    }

    // ═══════════════════════════════════════
    // YOUTUBE RESULTS
    // ═══════════════════════════════════════

    formatYouTubeResults(videos, query, isGroup = false) {
        if (!videos || videos.length === 0) return null;

        if (isGroup) {
            const top = videos[0];
            return `🎬 *${this._decodeHtml(top.title)}*\n▶️ ${this._cleanUrl(top.url)}`;
        }

        let msg = `🎬 *YouTube Results for "${query}"*\n${this.THIN_SEP}\n`;

        const topVideos = videos.slice(0, 3);
        topVideos.forEach((v, i) => {
            msg += `\n*${i + 1}.* ${this._decodeHtml(v.title)}`;
            const meta = [];
            if (v.channel) meta.push(`📺 ${v.channel}`);
            if (v.duration) meta.push(`⏱️ ${v.duration}`);
            if (v.views) meta.push(`👁️ ${this._formatViews(v.views)}`);
            if (meta.length > 0) msg += `\n   ${meta.join('  •  ')}`;
            msg += `\n   ▶️ ${this._cleanUrl(v.url)}`;
            if (i < topVideos.length - 1) msg += '\n';
        });

        const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        msg += `\n\n${this.THIN_SEP}\n🔍 *More videos:* ${ytSearchUrl}`;

        return msg;
    }

    // ═══════════════════════════════════════
    // NEWS
    // ═══════════════════════════════════════

    formatNews(articles, topic, isGroup = false) {
        if (!articles || articles.length === 0) return null;

        if (isGroup) {
            const top = articles[0];
            return `📰 *${top.title}*\n🔗 ${this._cleanUrl(top.link)}`;
        }

        let msg = `📰 *${topic ? topic + ' ' : ''}News Headlines*\n${this.THIN_SEP}\n`;

        articles.slice(0, 5).forEach((a, i) => {
            msg += `\n*${i + 1}.* ${a.title}`;
            if (a.source) msg += `\n   📌 _${a.source}_`;
            if (a.link) msg += `\n   🔗 ${this._cleanUrl(a.link)}`;
            if (i < Math.min(articles.length, 5) - 1) msg += '\n';
        });

        return msg;
    }

    // ═══════════════════════════════════════
    // JOKES
    // ═══════════════════════════════════════

    formatJoke(joke) {
        if (!joke) return null;

        if (joke.type === 'twopart') {
            return `😂 ${joke.setup}\n\n👉 _${joke.delivery}_`;
        }

        return `😂 ${joke.joke}`;
    }

    // ═══════════════════════════════════════
    // FINANCE
    // ═══════════════════════════════════════

    formatFinanceData(data, isGroup = false) {
        if (!data) return null;

        if (isGroup) {
            const arrow = data.change >= 0 ? '📈' : '📉';
            return `${arrow} *${data.name}*: $${data.price} (${data.change >= 0 ? '+' : ''}${data.changePercent}%)`;
        }

        let msg = `💰 *${data.name}* (${data.symbol})\n${this.THIN_SEP}\n\n`;
        const arrow = data.change >= 0 ? '📈' : '📉';
        msg += `${arrow} *Price:* $${data.price}\n`;
        msg += `📊 *24h Change:* ${data.change >= 0 ? '+' : ''}${data.changePercent}%\n`;
        if (data.marketCap) msg += `🏦 *Market Cap:* $${this._formatLargeNumber(data.marketCap)}\n`;
        if (data.volume) msg += `📦 *Volume:* $${this._formatLargeNumber(data.volume)}\n`;
        if (data.high) msg += `⬆️ *24h High:* $${data.high}\n`;
        if (data.low) msg += `⬇️ *24h Low:* $${data.low}`;

        return msg;
    }

    // ═══════════════════════════════════════
    // IMAGE / VISION
    // ═══════════════════════════════════════

    formatImageAnalysis(analysis, hasCaption = false) {
        if (!analysis) return null;

        // Vision responses are already natural language from Gemini
        // Just ensure clean formatting
        return analysis;
    }

    // ═══════════════════════════════════════
    // GENERIC HELPERS
    // ═══════════════════════════════════════

    /**
     * Wrap text with a header
     */
    withHeader(emoji, title, body) {
        return `${emoji} *${title}*\n${this.THIN_SEP}\n\n${body}`;
    }

    /**
     * Make a numbered list
     */
    numberedList(items, formatter = null) {
        return items.map((item, i) => {
            const text = formatter ? formatter(item) : item;
            return `*${i + 1}.* ${text}`;
        }).join('\n\n');
    }

    /**
     * Make a bullet list
     */
    bulletList(items) {
        return items.map(item => `• ${item}`).join('\n');
    }

    // ─── Internal Utilities ─────────────────

    _decodeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#x27;/g, "'");
    }

    _formatViews(views) {
        if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
        if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
        return views.toString();
    }

    _formatLargeNumber(num) {
        if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
        if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
        return num.toString();
    }

    /**
     * Clean long URLs by removing tracking/garbage params
     */
    _cleanUrl(url) {
        if (!url) return '';
        try {
            const u = new URL(url);

            // Keep youtube video IDs
            if (u.hostname.includes('youtube.com') && u.searchParams.has('v')) {
                return `https://youtu.be/${u.searchParams.get('v')}`;
            }

            // Keep google search queries but nothing else
            if (u.hostname.includes('google.com') && u.pathname.includes('/search')) {
                const q = u.searchParams.get('q');
                return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
            }

            // For everything else, strip query params to keep it clean
            u.search = '';
            u.hash = '';

            return u.toString().replace(/\/$/, ''); // Remove trailing slash
        } catch (e) {
            return url; // Return original if parsing fails
        }
    }
}

module.exports = new Formatter();
