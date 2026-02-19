/**
 * Chat Brain
 * Handles general conversation using Gemini AI
 * This is the primary brain for most messages
 * Includes model fallback, context injection, and self-reflection
 */

const config = require('../utils/config-loader');
const memoryStore = require('../memory/memory-store');

class ChatBrain {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.models = [
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-1.5-flash'
        ];
        console.log('💬 Chat Brain initialized');
    }

    /**
     * Generate AI response with full context
     */
    async process(contactId, message, context = {}) {
        const { isGroup, intent, emotion, personMemory, isNewContact, conversationRecap, abOverrides, quotedText } = context;

        // Build the system prompt with all context
        const systemPrompt = this._buildPrompt(context);

        // Get conversation history from memory
        const history = memoryStore.getFormattedHistory(contactId, isGroup ? 5 : 10);

        // Build Gemini request
        const requestBody = {
            contents: history,
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: this._getGenerationConfig(isGroup, intent, emotion, abOverrides),
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
            ]
        };

        // Try models in sequence
        for (const model of this.models) {
            try {
                const response = await this._callGemini(model, requestBody);
                if (response) {
                    // Optional: Self-reflection
                    const reflected = this._selfReflect(response, intent, emotion, isGroup);

                    return {
                        response: reflected,
                        source: `chat-brain/${model}`,
                        isQuickResponse: false
                    };
                }
            } catch (error) {
                console.error(`   ❌ [${model}] Failed:`, error.message);
            }
        }

        // All models failed
        throw new Error('All Gemini models failed');
    }

    /**
     * Call Gemini API
     */
    async _callGemini(model, requestBody) {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const response = await fetch(`${apiUrl}?key=${this.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(15000) // 15 second timeout
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        }

        return null;
    }

    /**
     * Build the full system prompt with context
     */
    _buildPrompt(context) {
        const { isGroup, intent, emotion, personMemory, isNewContact, conversationRecap, abOverrides, quotedText } = context;

        // Context notes for the LLM
        let contextNote = '';

        if (isNewContact) {
            contextNote += 'NOTE: This is a NEW person. Be welcoming and friendly.\n';
        }

        if (intent) {
            contextNote += `MESSAGE INTENT: ${intent.primary} (${intent.subIntent || 'general'})\n`;
            contextNote += `LANGUAGE: ${intent.language}\n`;
        }

        // Conversation recap for long conversations
        if (conversationRecap) {
            contextNote += `\n${conversationRecap}\n`;
        }

        // A/B test: follow-up question instruction
        if (abOverrides?.askFollowup) {
            contextNote += '\nIMPORTANT: End your response with a natural follow-up question to keep the conversation going.\n';
        }

        // Quoted/reply message context
        if (quotedText) {
            contextNote += `\nTHE USER IS REPLYING TO THIS PREVIOUS MESSAGE: "${quotedText}"\nMake sure your reply is contextually relevant to what they're replying to.\n`;
        }

        // Safety rules from memory
        const safetyPrompt = memoryStore.getSafetyPrompt();
        if (safetyPrompt) {
            contextNote += '\n' + safetyPrompt + '\n';
        }

        // Generate the full prompt
        const systemPrompt = config.generateSystemPrompt({
            isGroup,
            emotion,
            personMemory,
            contextNote
        });

        return systemPrompt;
    }

    /**
     * Dynamic generation config based on context
     */
    _getGenerationConfig(isGroup, intent, emotion, abOverrides = {}) {
        const intelligenceConfig = config.intelligenceConfig;

        // Base config
        const genConfig = {
            temperature: 0.8,
            topP: 0.9,
            maxOutputTokens: 256
        };

        // Group: shorter replies
        if (isGroup) {
            genConfig.maxOutputTokens = Math.min(
                intelligenceConfig.maxGroupReplyLength || 80,
                128
            );
            genConfig.temperature = 0.75;
        }

        // Emotional messages: more careful, less creative
        if (emotion?.primary === 'sad' || emotion?.primary === 'anxious') {
            genConfig.temperature = 0.6;
            genConfig.maxOutputTokens = 200;
        }

        // Knowledge questions: more factual
        if (['about_inquiry', 'work_inquiry', 'tech_inquiry'].includes(intent?.primary)) {
            genConfig.temperature = 0.5;
            genConfig.maxOutputTokens = 300;
        }

        // Casual chat: more creative
        if (['casual', 'greeting'].includes(intent?.primary)) {
            genConfig.temperature = 0.9;
            genConfig.maxOutputTokens = 128;
        }

        // A/B test overrides (applied last)
        if (abOverrides.temperature) {
            genConfig.temperature = abOverrides.temperature;
        }
        if (abOverrides.maxOutputTokens) {
            genConfig.maxOutputTokens = abOverrides.maxOutputTokens;
        }

        return genConfig;
    }

    /**
     * Self-Reflection Layer
     * Quick sanity check on the response before sending
     */
    _selfReflect(response, intent, emotion, isGroup) {
        let refined = response;

        // Trim excessive whitespace
        refined = refined.trim();

        // Remove any AI identity leaks
        const aiLeaks = [
            /as an ai/gi,
            /i('m| am) an? (ai|artificial|bot|language model|llm)/gi,
            /i('m| am) not (a )?(real|human) person/gi,
            /as a (large )?language model/gi,
            /i don't have (feelings|emotions|personal experiences)/gi,
            /i was (created|made|built|trained) by/gi,
            /my (training|programming|creators)/gi
        ];

        for (const pattern of aiLeaks) {
            if (pattern.test(refined)) {
                // Replace the problematic sentence entirely
                refined = refined.replace(pattern, '');
                console.log(`   🔧 Self-Reflection: Removed AI identity leak`);
            }
        }

        // Group messages should be short
        if (isGroup && refined.length > 200) {
            // Find the first 1-2 sentences
            const sentences = refined.split(/[.!?]+/).filter(s => s.trim().length > 0);
            if (sentences.length > 2) {
                refined = sentences.slice(0, 2).join('. ').trim();
                if (!refined.endsWith('.') && !refined.endsWith('!') && !refined.endsWith('?')) {
                    refined += '.';
                }
                console.log(`   🔧 Self-Reflection: Trimmed group response to 2 sentences`);
            }
        }

        // Clean up double spaces and extra newlines
        refined = refined.replace(/\n{3,}/g, '\n\n').replace(/  +/g, ' ');

        return refined;
    }
}

module.exports = new ChatBrain();
