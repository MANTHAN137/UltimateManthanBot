/**
 * Safety Brain
 * Filters all outgoing responses for safety violations
 * Runs AFTER the response is generated, BEFORE it's sent
 * 
 * Checks:
 * - Personal data leaks
 * - Commitment/promise making
 * - AI identity reveals
 * - Inappropriate content
 * - Sensitive topic handling
 */

class SafetyBrain {
    constructor() {
        // Only the most BLATANT patterns that would break the illusion
        // Keep this list MINIMAL — over-filtering causes broken/incomplete responses
        this.blockedPatterns = [
            // Blatant AI identity leaks only
            { pattern: /\bAs an AI\b/gi, replacement: '', reason: 'AI identity leak' },
            { pattern: /\bI am an AI\b/gi, replacement: '', reason: 'AI identity leak' },
            { pattern: /\bI'm an AI\b/gi, replacement: '', reason: 'AI identity leak' },
            { pattern: /\bI am a (large )?language model\b/gi, replacement: '', reason: 'AI identity leak' },
            { pattern: /\bI'm a (large )?language model\b/gi, replacement: '', reason: 'AI identity leak' },
            { pattern: /\bI am a chatbot\b/gi, replacement: '', reason: 'AI identity leak' },
            { pattern: /\bI'm a chatbot\b/gi, replacement: '', reason: 'AI identity leak' },

            // API/Technical leaks (these expose bot nature)
            { pattern: /\bapi key\b/gi, replacement: '', reason: 'Technical leak' },
            { pattern: /\b(gemini|gpt|claude|openai) (api|error|failed)\b/gi, replacement: '', reason: 'Technical leak' }
        ];
        // NOTE: Removed 'my training/programming/creators' — these can appear in normal conversation
        // NOTE: Removed phone/email redaction — the model knows Manthan's contact info and should share it
        // NOTE: Removed 'service unavailable' — over-zealous, can trigger on normal conversation

        // Topics that require deferral
        this.sensitiveTopics = [
            /\b(bank account|credit card|debit card|pin|password|otp)\b/gi,
            /\b(salary|income|earnings|net worth|how much (do you|you) (earn|make))\b/gi,
            /\b(meeting|appointment|schedule|available (when|tomorrow|today))\b/gi,
            /\b(payment|transfer|send money|upi|gpay|paytm)\b/gi,
            /\b(contract|agreement|legal|lawyer|court)\b/gi
        ];

        console.log('🛡️ Safety Brain initialized');
    }

    /**
     * Filter a response for safety
     * @param {string} response - The AI-generated response
     * @param {string} userMessage - The original user message
     * @param {Object} intent - The detected intent
     * @returns {string} Filtered response
     */
    filter(response, userMessage, intent) {
        let filtered = response;

        // 1. Check blocked patterns — light touch, don't mangle the response
        for (const { pattern, replacement, reason } of this.blockedPatterns) {
            // Reset BEFORE testing (important for /g regexes)
            pattern.lastIndex = 0;
            if (pattern.test(filtered)) {
                console.log(`   🛡️ Safety: Blocked ${reason}`);
                pattern.lastIndex = 0; // Reset again before replace
                filtered = filtered.replace(pattern, replacement);
            }
        }

        // 2. Check if user is asking about sensitive topics
        const isSensitive = this.sensitiveTopics.some(pattern => {
            pattern.lastIndex = 0;
            const result = pattern.test(userMessage);
            pattern.lastIndex = 0;
            return result;
        });

        if (isSensitive && this._responseContainsCommitment(filtered)) {
            console.log(`   🛡️ Safety: Sensitive topic detected, adding deferral`);
            filtered = "hmm, I'd rather not get into that over text. hit me up later and we can talk properly 🙏";
        }

        // 3. Light cleanup — fix double spaces but don't over-process
        filtered = filtered.replace(/  +/g, ' ').trim();

        // 4. Only use fallback if response is completely empty
        if (filtered.length < 2) {
            filtered = "hmm let me think on that 🤔";
        }

        return filtered;
    }

    /**
     * Check if response contains commitments
     */
    _responseContainsCommitment(response) {
        const commitmentPatterns = [
            /\bi('ll| will) (definitely|surely|meet|come|pay|send|transfer)/gi,
            /\b(i promise|i guarantee|confirmed|done deal)/gi,
            /\b(yes (i can|we can)|sure i('ll| will))/gi,
            /\b(my account|my number is|here's my|sending you)/gi
        ];

        return commitmentPatterns.some(pattern => {
            const result = pattern.test(response);
            pattern.lastIndex = 0;
            return result;
        });
    }

    /**
     * Check if a message is potentially dangerous/scam
     */
    isScam(message) {
        const scamPatterns = [
            /\b(click|tap) (this|here|the) (link|url)\b/gi,
            /\b(win|won|winner).*(prize|lottery|money|lakh|crore)\b/gi,
            /\b(send|forward) (this|to) (\d+|all|everyone)\b/gi,
            /\b(verify|confirm) your (account|identity|number)\b/gi,
            /\b(limited time|act now|urgent|immediately|expires)\b/gi
        ];

        return scamPatterns.some(pattern => {
            const result = pattern.test(message);
            pattern.lastIndex = 0;
            return result;
        });
    }
}

module.exports = new SafetyBrain();
