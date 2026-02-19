/**
 * Humanizer
 * Makes bot responses feel authentically human
 * 
 * Features:
 * - Typing delay simulation (variable, contextual)
 * - Reply length adjustment
 * - Tone matching based on time-of-day
 * - Occasional imperfections (human-like)
 * - Group vs DM adaptation
 */

const config = require('../utils/config-loader');

class Humanizer {
    constructor() {
        // Filler words that make text feel natural
        this.fillerPrefixes = [
            '', '', '', '', '', // Most of the time, no prefix
            'hmm ', 'well ', 'acha ', 'haan ', 'okay so '
        ];

        console.log('🎭 Humanizer initialized');
    }

    /**
     * Humanize a response
     * @param {string} response - The bot's response
     * @param {Object} context - { isGroup, emotion, intent, personMemory, timeContext }
     */
    humanize(response, context = {}) {
        const { isGroup, emotion, intent, personMemory, timeContext } = context;

        let humanized = response;

        // 1. Trim excessive formality
        humanized = this._trimFormality(humanized);

        // 2. Match person's communication style
        if (personMemory?.communicationStyle) {
            humanized = this._matchStyle(humanized, personMemory.communicationStyle);
        }

        // 3. Time-based adjustments
        if (timeContext) {
            humanized = this._adjustForTime(humanized, timeContext);
        }

        // 4. Group-specific trimming
        if (isGroup) {
            humanized = this._trimForGroup(humanized);
        }

        // 5. Occasional filler word (5% chance)
        if (Math.random() < 0.05 && !isGroup) {
            const filler = this.fillerPrefixes[Math.floor(Math.random() * this.fillerPrefixes.length)];
            if (filler) {
                humanized = filler + humanized.charAt(0).toLowerCase() + humanized.slice(1);
            }
        }

        return humanized;
    }

    /**
     * Calculate typing delay based on response and context
     */
    getTypingDelay(response, context = {}) {
        const { isGroup, intent, timeContext } = context;
        const intelligenceConfig = config.intelligenceConfig;

        const baseDelay = intelligenceConfig.typingDelayBase || 800;
        const perCharDelay = intelligenceConfig.typingDelayPerChar || 8;
        const maxDelay = intelligenceConfig.typingDelayMax || 5000;

        let delay = baseDelay + (response.length * perCharDelay / 10);

        // Groups: faster replies
        if (isGroup) {
            delay *= 0.6;
        }

        // Quick intents: faster
        if (['greeting', 'farewell', 'thanks'].includes(intent?.primary)) {
            delay *= 0.5;
        }

        // Late night: slightly slower (sleepy feel)
        if (timeContext?.isLateNight) {
            delay *= 1.3;
        }

        // Add small random variation (±20%)
        const variation = 0.8 + (Math.random() * 0.4);
        delay *= variation;

        return Math.min(Math.max(delay, 600), maxDelay);
    }

    /**
     * Remove overly formal language that sounds bot-like
     */
    _trimFormality(response) {
        let cleaned = response;

        // Remove generic formal openers
        const formalOpeners = [
            /^(certainly|absolutely|of course|sure thing|i'd be happy to|i'd love to|i would be glad to)[,!.]?\s*/i,
            /^(thank you for (asking|reaching out|your message))[,!.]?\s*/i,
            /^(that's a great question)[,!.]?\s*/i,
            /^(hello there)[,!.]?\s*/i
        ];

        for (const pattern of formalOpeners) {
            cleaned = cleaned.replace(pattern, '');
        }

        // Remove formal closers
        const formalClosers = [
            /\s*(feel free to (ask|reach out|let me know) (if|anytime).*?)$/i,
            /\s*(i hope (this|that|i) (helps|answered|was helpful).*?)$/i,
            /\s*(don't hesitate to.*?)$/i,
            /\s*(is there anything else.*?)$/i
        ];

        for (const pattern of formalClosers) {
            cleaned = cleaned.replace(pattern, '');
        }

        return cleaned.trim();
    }

    /**
     * Match the person's communication style
     */
    _matchStyle(response, style) {
        switch (style) {
            case 'casual-friendly':
                // Already casual, just ensure lowercase
                return response;

            case 'formal':
                // Keep it slightly more structured
                return response;

            case 'hinglish':
                // Don't modify - the LLM should handle Hinglish from the prompt
                return response;

            case 'brief':
                // Trim to be concise
                if (response.length > 150) {
                    const sentences = response.split(/[.!?]+/).filter(s => s.trim());
                    if (sentences.length > 2) {
                        return sentences.slice(0, 2).join('. ').trim() + '.';
                    }
                }
                return response;

            default:
                return response;
        }
    }

    /**
     * Adjust tone based on time of day
     */
    _adjustForTime(response, timeContext) {
        // Late night: don't add energy
        if (timeContext.isLateNight && response.includes('!')) {
            // Reduce exclamation marks at night
            let modified = response.replace(/!{2,}/g, '!');
            // 50% chance to replace ! with . at night
            if (Math.random() > 0.5) {
                modified = modified.replace(/!$/, '.');
            }
            return modified;
        }

        return response;
    }

    /**
     * Trim response for group context
     */
    _trimForGroup(response) {
        const maxLen = config.intelligenceConfig.maxGroupReplyLength || 600;

        if (response.length <= maxLen) return response;

        // Try to find a natural break point
        const sentences = response.match(/[^.!?]+[.!?]+(\s|$)/g) || [response];
        let grouped = '';

        for (const sentence of sentences) {
            if ((grouped + sentence).length > maxLen) {
                // If we have at least one sentence, stop here. 
                // Otherwise (first sentence is huge), take it but truncate hard later if needed.
                if (grouped.length > 0) break;
            }
            grouped += sentence;
        }

        if (grouped.length > 0) return grouped.trim();

        // Hard truncate as last resort if sentence splitting failed
        return response.substring(0, maxLen).trim() + '...';
    }
}

module.exports = new Humanizer();
