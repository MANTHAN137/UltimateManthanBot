/**
 * Chat Brain v2.0
 * Handles general conversation using Gemini AI
 * This is the primary brain for most messages
 * 
 * Philosophy: Give the model MAXIMUM freedom to respond naturally.
 * The model decides the tone, length, style, and structure.
 * We only provide context and identity — never micro-manage the output.
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
        console.log('💬 Chat Brain v2.0 initialized (full freedom mode)');
    }

    /**
     * Generate AI response with full context
     */
    async process(contactId, message, context = {}) {
        const { isGroup, intent, emotion, personMemory, isNewContact, conversationRecap, abOverrides, quotedText, imageBuffer, externalFindings } = context;

        // Build the system prompt with all context
        const systemPrompt = this._buildPrompt(context);

        // Get conversation history from memory — more history = better context
        const history = memoryStore.getFormattedHistory(contactId, isGroup ? 8 : 15);

        // Prepare the current message part
        const currentMessageParts = [];

        // Add text if present
        if (message && message.trim()) {
            currentMessageParts.push({ text: message });
        } else if (imageBuffer) {
            currentMessageParts.push({ text: "(sent an image)" });
        }

        // Add image if present (Multimodal support)
        if (imageBuffer) {
            currentMessageParts.push({
                inlineData: {
                    mimeType: "image/jpeg",
                    data: imageBuffer.toString('base64')
                }
            });
            console.log(`   👁️ Multimodal: Image added to Gemini request`);
        }

        // Add the current message to history if it's not empty
        if (currentMessageParts.length > 0) {
            history.push({
                role: 'user',
                parts: currentMessageParts
            });
        }

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
                    // Light cleanup only — don't over-process
                    const cleaned = this._lightCleanup(response);

                    return {
                        response: cleaned,
                        source: `chat-brain/${model}`,
                        isQuickResponse: false
                    };
                }
            } catch (error) {
                console.error(`   ❌ [${model}] Failed:`, error.message);
                if (error.message.includes('not found')) continue; // Skip if model doesn't exist
            }
        }

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
            signal: AbortSignal.timeout(20000) // 20 second timeout for longer responses
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
     * This is the BRAIN of the bot — it tells the model WHO it is and HOW to think
     */
    _buildPrompt(context) {
        const { isGroup, intent, emotion, personMemory, isNewContact, conversationRecap, abOverrides, quotedText } = context;

        // Context notes for the LLM
        let contextNote = '';

        if (isNewContact) {
            contextNote += 'This person is texting you for the first time. Be naturally welcoming — like you would with any new person hitting you up on WhatsApp.\n';
        }

        if (intent) {
            contextNote += `Their message vibe: ${intent.primary}${intent.subIntent ? ` (${intent.subIntent})` : ''}\n`;
            contextNote += `They're writing in: ${intent.language}\n`;
        }

        // Conversation recap for long conversations
        if (conversationRecap) {
            contextNote += `\nWhat you've been talking about so far:\n${conversationRecap}\n`;
        }

        // A/B test: follow-up question instruction
        if (abOverrides?.askFollowup) {
            contextNote += '\nKeep the convo going naturally — ask them something back if it feels right.\n';
        }

        // Quoted/reply message context
        if (quotedText) {
            contextNote += `\nThey're replying to this previous message: "${quotedText}"\nMake sure your reply is relevant to what they're responding to.\n`;
        }

        // External research results (search, youtube, etc.)
        if (externalFindings) {
            contextNote += `\n═══ EXTERNAL RESEARCH FINDINGS ═══\n${externalFindings}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            contextNote += `Use the above info to answer the user's query naturally. Don't just list them — speak about them like a real person would. If the info isn't relevant, ignore it.\n`;
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
     * Generation config — GENEROUS limits, let the model breathe
     * 
     * The model is smart enough to know when to write 2 words vs 2 paragraphs.
     * We just set a high ceiling and let it decide.
     */
    _getGenerationConfig(isGroup, intent, emotion, abOverrides = {}) {
        const intelligenceConfig = config.intelligenceConfig;

        // Base config — generous defaults, model decides natural length
        const genConfig = {
            temperature: 0.9,     // High creativity for natural conversation
            topP: 0.95,           // Wide sampling for diverse responses
            topK: 40,             // Good balance of diversity
            maxOutputTokens: intelligenceConfig.maxDMReplyLength || 2048  // Let the model decide length naturally
        };

        // Group: still generous but slightly lower ceiling
        if (isGroup) {
            genConfig.maxOutputTokens = intelligenceConfig.maxGroupReplyLength || 800;
            genConfig.temperature = 0.85;  // Slightly less random in groups
        }

        // Emotional messages: warm and thoughtful, not robotic
        if (emotion?.primary === 'sad' || emotion?.primary === 'anxious') {
            genConfig.temperature = 0.75;  // Slightly more careful but still natural
            // NO token limit reduction — let the model decide how much comfort to give
        }

        // Knowledge questions: slightly more precise
        if (['about_inquiry', 'work_inquiry', 'tech_inquiry'].includes(intent?.primary)) {
            genConfig.temperature = 0.7;
        }

        // Casual/greeting: maximum creativity and naturalness
        if (['casual', 'greeting'].includes(intent?.primary)) {
            genConfig.temperature = 0.95;
            // NO token limit — even casual chat can go deep sometimes
        }

        // Challenging/debate: confident and articulate
        if (emotion?.primary === 'challenging' || intent?.primary === 'challenge') {
            genConfig.temperature = 0.8;
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
     * Light cleanup — MINIMAL post-processing
     * Only fix things that would obviously break the illusion.
     * Do NOT over-process or strip personality from the response.
     */
    _lightCleanup(response) {
        let cleaned = response.trim();

        // Only catch BLATANT AI identity reveals (the obvious ones)
        const blatantLeaks = [
            /\bAs an AI\b/gi,
            /\bI am an AI\b/gi,
            /\bI'm an AI\b/gi,
            /\bI am a language model\b/gi,
            /\bI'm a language model\b/gi,
            /\bas a large language model\b/gi,
            /\bI was trained by\b/gi,
            /\bI am a chatbot\b/gi,
            /\bI'm a chatbot\b/gi
        ];

        for (const pattern of blatantLeaks) {
            if (pattern.test(cleaned)) {
                // Remove just the sentence containing the leak
                cleaned = cleaned.replace(new RegExp(`[^.!?\n]*${pattern.source}[^.!?\n]*[.!?]?\\s*`, 'gi'), '').trim();
                console.log(`   🔧 Removed AI identity leak`);
            }
        }

        // Clean up excessive whitespace only
        cleaned = cleaned.replace(/\n{4,}/g, '\n\n').replace(/  +/g, ' ');

        return cleaned;
    }
}

module.exports = new ChatBrain();
