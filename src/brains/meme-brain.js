/**
 * Meme Brain
 * Fetches and sends random memes from free APIs
 * Sources: Reddit meme API, Imgflip
 */

class MemeBrain {
    constructor() {
        this.MEME_APIS = [
            'https://meme-api.com/gimme',
            'https://meme-api.com/gimme/memes',
            'https://meme-api.com/gimme/dankmemes',
            'https://meme-api.com/gimme/ProgrammerHumor'
        ];
        console.log('🖼️ Meme Brain initialized');
    }

    /**
     * Process a meme request
     * Returns image URL + caption for bot.js to send as image message
     */
    async process(query, isGroup = false) {
        const subreddit = this._detectSubreddit(query);

        try {
            const meme = await this._fetchMeme(subreddit);

            if (!meme) {
                return {
                    response: "couldn't find a good meme rn 😅 try again in a sec",
                    source: 'meme-brain/failed',
                    isQuickResponse: true
                };
            }

            return {
                response: meme.title || '😂',
                source: 'meme-brain',
                isQuickResponse: true,
                imageUrl: meme.url,
                isMeme: true
            };

        } catch (error) {
            console.error(`   ❌ Meme Brain error: ${error.message}`);
            return {
                response: "meme machine broke 😂 try again",
                source: 'meme-brain/error',
                isQuickResponse: true
            };
        }
    }

    /**
     * Fetch a random meme
     */
    async _fetchMeme(subreddit = '') {
        const url = subreddit
            ? `https://meme-api.com/gimme/${subreddit}`
            : 'https://meme-api.com/gimme';

        try {
            const response = await fetch(url, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(10000)
            });

            const data = await response.json();

            if (data.url && !data.nsfw) {
                return {
                    title: data.title || '',
                    url: data.url,
                    subreddit: data.subreddit || '',
                    ups: data.ups || 0
                };
            }

            return null;
        } catch (error) {
            console.error(`   ⚠️ Meme API failed: ${error.message}`);

            // Fallback: try another endpoint
            try {
                const fallback = await fetch('https://meme-api.com/gimme/memes', {
                    signal: AbortSignal.timeout(8000)
                });
                const data = await fallback.json();
                if (data.url && !data.nsfw) {
                    return { title: data.title || '', url: data.url };
                }
            } catch (e) {
                // Both failed
            }

            return null;
        }
    }

    /**
     * Check if message is a meme request
     */
    isMemeRequest(message) {
        const msg = message.toLowerCase();
        return /\b(meme|memes|send meme|show meme|random meme|dank|dank meme|memay)\b/i.test(msg);
    }

    /**
     * Detect subreddit from query
     */
    _detectSubreddit(message) {
        const msg = message.toLowerCase();
        if (/programming|coder|developer|tech|code/i.test(msg)) return 'ProgrammerHumor';
        if (/wholesome|cute|sweet/i.test(msg)) return 'wholesomememes';
        if (/dank/i.test(msg)) return 'dankmemes';
        if (/indian|india|desi/i.test(msg)) return 'IndianDankMemes';
        if (/anime/i.test(msg)) return 'animememes';
        return '';
    }
}

module.exports = new MemeBrain();
