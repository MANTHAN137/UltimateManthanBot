/**
 * Formatter Engine
 * Clean formatting for WhatsApp bot outputs
 * Uses WhatsApp markdown: *bold*, _italic_, ```monospace```, ~strikethrough~
 */

class Formatter {
    constructor() {
        this.THIN_SEP = '─────────────────────';
        console.log('🎨 Formatter Engine initialized');
    }

    // ═══ SEARCH RESULTS ═══

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

    // ═══ YOUTUBE RESULTS ═══

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

    // ═══ IMAGE / VISION ═══

    formatImageAnalysis(analysis) {
        if (!analysis) return null;
        return analysis;
    }

    // ═══ UTILITIES ═══

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

    /**
     * Clean long URLs by removing tracking/garbage params
     */
    _cleanUrl(url) {
        if (!url) return '';
        let target = url;
        if (target.startsWith('//')) target = 'https:' + target;

        try {
            const u = new URL(target);

            if (u.pathname.includes('/y.js')) return url;

            // YouTube → short youtu.be link
            if (u.hostname.includes('youtube.com') && u.searchParams.has('v')) {
                return `https://youtu.be/${u.searchParams.get('v')}`;
            }

            // Google search → clean query only
            if (u.hostname.includes('google.com') && u.pathname.includes('/search')) {
                const q = u.searchParams.get('q');
                return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
            }

            // Everything else → strip query params
            u.search = '';
            u.hash = '';

            return u.toString().replace(/\/$/, '');
        } catch (e) {
            return url;
        }
    }
}

module.exports = new Formatter();
