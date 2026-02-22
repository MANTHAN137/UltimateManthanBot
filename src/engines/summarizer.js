/**
 * Conversation Summarizer
 * Auto-summarizes long conversations using Gemini AI
 * 
 * Capabilities:
 * - Summarize conversation when it gets long
 * - Generate quick recap for context switching
 * - Create daily conversation digests
 * - Smart compression of context window
 */

const memoryStore = require('../memory/memory-store');

class ConversationSummarizer {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.SUMMARY_THRESHOLD = 15; // Summarize when conversation exceeds this many messages
        this.summaryCache = new Map();

        console.log('📝 Conversation Summarizer initialized');
    }

    /**
     * Summarize a conversation if it's long enough
     * @param {string} contactId - Contact identifier
     * @returns {{ summary: string, messageCount: number, keyTopics: string[] } | null}
     */
    async summarize(contactId) {
        const history = memoryStore.getRecentHistory(contactId, 30);

        if (history.length < this.SUMMARY_THRESHOLD) {
            return null; // Not enough messages to summarize
        }

        // Check cache
        const cacheKey = `${contactId}_${history.length}`;
        if (this.summaryCache.has(cacheKey)) {
            return this.summaryCache.get(cacheKey);
        }

        try {
            const conversationText = this._formatForSummary(history);
            const summary = await this._generateSummary(conversationText);

            if (summary) {
                const result = {
                    summary: summary.summary,
                    keyTopics: summary.topics,
                    sentiment: summary.sentiment,
                    messageCount: history.length,
                    generatedAt: new Date().toISOString()
                };

                this.summaryCache.set(cacheKey, result);
                return result;
            }

        } catch (error) {
            console.error('   ❌ Summarizer error:', error.message);
        }

        return null;
    }

    /**
     * Get a quick context recap for the LLM
     * Used to compress conversation history into a shorter prompt
     * @param {string} contactId
     * @returns {string} Context string for system prompt
     */
    async getContextRecap(contactId) {
        const summary = await this.summarize(contactId);
        if (!summary) return '';

        return `CONVERSATION RECAP (${summary.messageCount} messages):
${summary.summary}
Key Topics: ${summary.keyTopics.join(', ')}
Overall Mood: ${summary.sentiment}`;
    }

    /**
     * Generate daily digest of all conversations
     * @returns {string} Daily summary
     */
    async getDailyDigest() {
        try {
            const stats = memoryStore.getStats();
            const allContacts = this._getActiveContacts();

            if (allContacts.length === 0) {
                return 'No conversations today.';
            }

            let digest = `📊 *Daily Digest*\n`;
            digest += `Total contacts: ${stats.totalPersons}\n`;
            digest += `Total messages: ${stats.totalMessages}\n\n`;

            for (const contactId of allContacts.slice(0, 10)) { // Top 10 contacts
                const person = memoryStore.getPersonMemory(contactId);
                const history = memoryStore.getRecentHistory(contactId, 5);

                if (history.length > 0) {
                    const name = person?.display_name || contactId.replace('@s.whatsapp.net', '');
                    digest += `• *${name}*: ${history.length} messages\n`;

                    const lastMsg = history[history.length - 1];
                    digest += `  Last: "${lastMsg.content.substring(0, 50)}..."\n`;
                }
            }

            return digest;

        } catch (error) {
            console.error('   ❌ Daily digest error:', error.message);
            return 'Error generating digest.';
        }
    }

    /**
     * Compress conversation history for the LLM context window
     * Instead of sending all messages, send: summary + last 5 messages
     * @param {string} contactId
     * @returns {Array} Optimized conversation history for API
     */
    async getCompressedHistory(contactId) {
        const fullHistory = memoryStore.getRecentHistory(contactId, 30);

        if (fullHistory.length <= 10) {
            // Short enough, no compression needed
            return memoryStore.getFormattedHistory(contactId, 10);
        }

        // Get summary of older messages
        const olderMessages = fullHistory.slice(0, -5);
        const recentMessages = fullHistory.slice(-5);

        const summaryText = await this._quickSummarize(olderMessages);

        // Build compressed history
        const compressed = [];

        // Add summary as first "context" message
        if (summaryText) {
            compressed.push({
                role: 'user',
                parts: [{ text: `[Context from earlier: ${summaryText}]` }]
            });
            compressed.push({
                role: 'model',
                parts: [{ text: 'Got it, I remember the context.' }]
            });
        }

        // Add recent messages
        for (const msg of recentMessages) {
            compressed.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            });
        }

        return compressed;
    }

    /**
     * Use Gemini to generate a conversation summary
     */
    async _generateSummary(conversationText) {
        if (!this.apiKey) {
            return this._localSummary(conversationText);
        }

        try {
            const prompt = `Summarize this WhatsApp conversation in a brief, natural way. 
Extract: 1) A 2-3 sentence summary, 2) Key topics discussed, 3) Overall sentiment.

Respond in JSON format:
{"summary": "...", "topics": ["topic1", "topic2"], "sentiment": "positive/negative/neutral/mixed"}

CONVERSATION:
${conversationText}`;

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.3,
                            maxOutputTokens: 256,
                            responseMimeType: 'application/json'
                        }
                    }),
                    signal: AbortSignal.timeout(10000)
                }
            );

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                try {
                    return JSON.parse(text);
                } catch {
                    return {
                        summary: text,
                        topics: [],
                        sentiment: 'neutral'
                    };
                }
            }

        } catch (error) {
            console.error('   ❌ Gemini summary error:', error.message);
        }

        return this._localSummary(conversationText);
    }

    /**
     * Quick summary for context compression (simpler prompt)
     */
    async _quickSummarize(messages) {
        if (!this.apiKey) {
            return this._localQuickSummary(messages);
        }

        try {
            const text = messages.map(m => `${m.role}: ${m.content}`).join('\n');

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: `Briefly summarize what was discussed in 1-2 sentences:\n${text}`
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.2,
                            maxOutputTokens: 100
                        }
                    }),
                    signal: AbortSignal.timeout(8000)
                }
            );

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || null;

        } catch (error) {
            return this._localQuickSummary(messages);
        }
    }

    /**
     * Local summary fallback (no API)
     */
    _localSummary(conversationText) {
        const lines = conversationText.split('\n').filter(l => l.trim());
        const topics = [];

        // Extract topics from conversation
        const topicPatterns = {
            'tech': /tech|code|programming|software|api|bug|deploy/i,
            'work': /work|job|office|company|project|deadline/i,
            'personal': /life|family|friend|relationship|health|feel/i,
            'ai': /ai|machine learning|gpt|gemini|bot|neural/i,
            'finance': /money|invest|stock|crypto|salary|payment/i,
            'education': /college|study|exam|course|learn|degree/i
        };

        for (const [topic, pattern] of Object.entries(topicPatterns)) {
            if (pattern.test(conversationText)) topics.push(topic);
        }

        return {
            summary: `Conversation with ${lines.length} messages covering ${topics.length > 0 ? topics.join(', ') : 'general topics'}.`,
            topics: topics.length > 0 ? topics : ['general'],
            sentiment: 'neutral'
        };
    }

    /**
     * Local quick summary fallback
     */
    _localQuickSummary(messages) {
        if (messages.length === 0) return null;

        const userMessages = messages.filter(m => m.role === 'user');
        const topics = userMessages.map(m => m.content.substring(0, 50));

        return `Earlier discussion covered: ${topics.slice(0, 3).join('; ')}`;
    }

    /**
     * Format conversation for summary prompt
     */
    _formatForSummary(history) {
        return history
            .map(msg => `${msg.role === 'user' ? 'User' : 'Manthan'}: ${msg.content}`)
            .join('\n');
    }

    /**
     * Get list of active contacts from recent conversations
     */
    _getActiveContacts() {
        try {
            const db = memoryStore.db;
            const rows = db.prepare(`
                SELECT DISTINCT contact_id 
                FROM conversation_log 
                WHERE timestamp > datetime('now', '-1 day')
                ORDER BY timestamp DESC
            `).all();
            return rows.map(r => r.contact_id);
        } catch {
            return [];
        }
    }

    /**
     * Clear summary cache
     */
    clearCache() {
        this.summaryCache.clear();
    }
}

module.exports = new ConversationSummarizer();
