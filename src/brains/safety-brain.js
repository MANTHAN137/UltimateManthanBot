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
        // Patterns that should NEVER appear in responses
        this.blockedPatterns = [
            // AI identity leaks
            { pattern: /\bas an ai\b/gi, replacement: '', reason: 'AI identity leak' },
            { pattern: /\bi('m| am) (a |an )?(ai|artificial intelligence|bot|language model|llm|chatbot)/gi, replacement: '', reason: 'AI identity leak' },
            { pattern: /\bi('m| am) not (a |an )?(real|actual) (person|human)/gi, replacement: '', reason: 'AI identity leak' },
            { pattern: /\bas a (large )?language model/gi, replacement: '', reason: 'AI identity leak' },
            { pattern: /\bmy (training|programming|creators|developers)/gi, replacement: '', reason: 'AI identity leak' },
            { pattern: /\bi (was|am) (created|made|built|trained|programmed) (by|at)/gi, replacement: '', reason: 'AI identity leak' },
            { pattern: /\b(openai|anthropic|google ai|deepmind|meta ai)\b/gi, replacement: '', reason: 'AI company reference' },

            // Personal data patterns
            { pattern: /\b\d{10,}\b/g, replacement: '[REDACTED]', reason: 'Phone number leak' },
            { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[REDACTED]', reason: 'Email leak' },

            // API/Technical leaks
            { pattern: /\bapi (key|limit|error|unavailable|exceeded)\b/gi, replacement: '', reason: 'Technical leak' },
            { pattern: /\b(service|server) (unavailable|down|error)\b/gi, replacement: '', reason: 'Technical leak' },
            { pattern: /\b(gemini|gpt|claude|openai) (api|error|failed)\b/gi, replacement: '', reason: 'Technical leak' }
        ];

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

        // 1. Check blocked patterns
        for (const { pattern, replacement, reason } of this.blockedPatterns) {
            if (pattern.test(filtered)) {
                console.log(`   🛡️ Safety: Blocked ${reason}`);
                filtered = filtered.replace(pattern, replacement);
            }
            // Reset regex lastIndex
            pattern.lastIndex = 0;
        }

        // 2. Check if user is asking about sensitive topics
        const isSensitive = this.sensitiveTopics.some(pattern => {
            const result = pattern.test(userMessage);
            pattern.lastIndex = 0;
            return result;
        });

        if (isSensitive && this._responseContainsCommitment(filtered)) {
            console.log(`   🛡️ Safety: Sensitive topic detected, adding deferral`);
            filtered = "hmm, I'd rather not get into that over text. hit me up later and we can talk properly 🙏";
        }

        // 3. Clean up empty spaces from removals
        filtered = filtered.replace(/\s{2,}/g, ' ').trim();

        // 4. If response became too short after filtering, use fallback
        if (filtered.length < 5) {
            filtered = "let me think about that and get back to you 🤔";
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
