/**
 * Music Brain
 * Detects music queries and returns search links
 * No API key needed — generates direct search URLs
 * 
 * Capabilities:
 * - Detect song/music requests
 * - Generate YouTube Music, Spotify, JioSaavn search links
 * - Format music recommendations
 */

class MusicBrain {
    constructor() {
        this.musicPatterns = [
            /\b(play|song|music|gana|gaana|bajao|sunao|listen)\b/i,
            /\b(singer|artist|album|lyrics|track)\b/i,
            /\b(spotify|jiosaavn|gaana\.com|wynk|youtube music)\b/i
        ];

        console.log('🎵 Music Brain initialized');
    }

    /**
     * Check if message is a music request
     */
    isMusicRequest(message) {
        const msg = message.toLowerCase();
        // Must match music pattern but NOT be a YouTube video request
        const isMusic = this.musicPatterns.some(p => p.test(msg));
        const isYouTubeVideo = /\b(video|tutorial|how to|review|vlog)\b/i.test(msg);
        return isMusic && !isYouTubeVideo;
    }

    /**
     * Process a music request
     */
    async process(message, isGroup = false) {
        const query = this._cleanQuery(message);
        if (!query || query.length < 2) return null;

        const encodedQuery = encodeURIComponent(query);

        // Generate search links for different platforms
        const ytMusicLink = `https://music.youtube.com/search?q=${encodedQuery}`;
        const spotifyLink = `https://open.spotify.com/search/${encodedQuery}`;
        const jiosaavnLink = `https://www.jiosaavn.com/search/${encodedQuery}`;
        const youtubeLink = `https://www.youtube.com/results?search_query=${encodedQuery}+official+audio`;

        if (isGroup) {
            return {
                response: `🎵 *${query}*\n\n▶️ YouTube: ${youtubeLink}\n🎧 Spotify: ${spotifyLink}`,
                source: 'music-brain',
                isQuickResponse: true
            };
        }

        const response = `🎵 *Music Search: ${query}*\n\n` +
            `▶️ *YouTube Music:* ${ytMusicLink}\n\n` +
            `🟢 *Spotify:* ${spotifyLink}\n\n` +
            `🎶 *JioSaavn:* ${jiosaavnLink}\n\n` +
            `📺 *YouTube:* ${youtubeLink}\n\n` +
            `_Pick your favorite platform and enjoy! 🎧_`;

        return {
            response,
            source: 'music-brain',
            isQuickResponse: true
        };
    }

    /**
     * Clean query for music search
     */
    _cleanQuery(message) {
        return message
            .replace(/\b(play|song|music|gana|gaana|bajao|sunao|listen|find|search|put on|baja|bajao|singer|artist|album|lyrics|track|spotify|jiosaavn|youtube music|please|pls|plz|can you|could you|mujhe|mera|mere|liye)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
}

module.exports = new MusicBrain();
