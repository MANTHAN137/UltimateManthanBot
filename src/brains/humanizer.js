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

        // 1. Light formality trim (only the most obvious bot-speak)
        humanized = this._trimFormality(humanized);

        // 2. Time-based adjustments (very light touch)
        if (timeContext) {
            humanized = this._adjustForTime(humanized, timeContext);
        }

        // 3. Group-specific trimming (only if way too long)
        if (isGroup) {
            humanized = this._trimForGroup(humanized);
        }

        // NOTE: We do NOT match person's communication style anymore.
        // The system prompt already tells the model to match the person's vibe.
        // Post-processing style matching was causing truncation and loss of content.

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

        // Only remove the MOST OBVIOUS robotic openers that nobody uses in real texting
        const formalOpeners = [
            /^(certainly|absolutely|sure thing|i'd be happy to|i'd love to|i would be glad to)[,!.]?\s*/i,
            /^(thank you for (asking|reaching out|your message))[,!.]?\s*/i,
            /^(that's a (great|wonderful|excellent) question)[,!.]?\s*/i,
        ];

        for (const pattern of formalOpeners) {
            cleaned = cleaned.replace(pattern, '');
        }

        // NOTE: We do NOT trim closers anymore.
        // The system prompt explicitly tells the model not to use formal language.
        // Removing closers was causing responses to feel cut off and incomplete.

        return cleaned.trim();
    }

    /**
     * Match the person's communication style
     */
    // Style matching removed — the model handles this via the system prompt now.
    // Previously this was truncating 'brief' style responses to 150 chars which killed good content.

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
