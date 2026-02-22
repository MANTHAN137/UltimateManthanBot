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
        const { isGroup, intent, emotion, personMemory, isNewContact, conversationRecap, quotedText, imageBuffer, externalFindings } = context;

        // Build the system prompt with all context
        const systemPrompt = this._buildPrompt(context);

        // Get conversation history from memory — more history = better context
        const history = memoryStore.getFormattedHistory(contactId, isGroup ? 20 : 40);

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
            generationConfig: this._getGenerationConfig(isGroup, intent, emotion),
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
                    // Light cleanup — don't over-process
                    let cleaned = this._lightCleanup(response);

                    // Strip links if search/youtube wasn't explicitly requested
                    // Gemini sometimes generates URLs on its own — remove them for pure text
                    if (!externalFindings) {
                        cleaned = this._stripLinks(cleaned);
                    }

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
        const { isGroup, intent, emotion, personMemory, isNewContact, conversationRecap, quotedText, externalFindings } = context;

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

        // Quoted/reply message context
        if (quotedText) {
            contextNote += `\nThey're replying to this previous message: "${quotedText}"\nMake sure your reply is relevant to what they're responding to.\n`;
        }

        // External research results (search, youtube, etc.)
        if (externalFindings) {
            contextNote += `\n═══ EXTERNAL RESEARCH FINDINGS ═══\n${externalFindings}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            contextNote += `Use the above info to answer the user's query naturally. Include the links/sources provided. Don't just list them — speak about them like a real person would. If the info isn't relevant, ignore it.\n`;
        } else {
            // NO external findings → pure text mode
            contextNote += `\n═══ IMPORTANT: NO LINKS ═══\nDo NOT include any URLs, links, or website addresses in your response. The user didn't ask for search results. Just answer from your own knowledge in pure text. If you don't know something, be honest about it — don't make up links.\n`;
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
    _getGenerationConfig(isGroup, intent, emotion) {
        const intelligenceConfig = config.intelligenceConfig;

        // Base config — maximum creativity, model decides natural length
        const genConfig = {
            temperature: 1.0,     // Maxed creativity for deep conversation
            topP: 0.99,            // Near-total freedom
            topK: 60,             // More diverse vocabulary
            maxOutputTokens: intelligenceConfig.maxDMReplyLength || 2048  // Let the model decide length naturally
        };

        // Group: still generous but slightly lower ceiling
        if (isGroup) {
            genConfig.maxOutputTokens = intelligenceConfig.maxGroupReplyLength || 1200;
            genConfig.temperature = 0.95;  // Keep it High!
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
            /\bAs (an AI|a bot|a chatbot|a language model|Manthan)\b/gi,
            /\bI am (an AI|a bot|a chatbot|a language model|Manthan)\b/gi,
            /\bBeing Manthan\b/gi,
            /\bIn my role as\b/gi,
            /\bI'm here to help\b/gi,
            /\bHow can I assist you\b/gi,
            /\bI was trained by\b/gi,
            /\bI don't have feelings\b/gi
        ];

        for (const pattern of blatantLeaks) {
            if (pattern.test(cleaned)) {
                // Remove the sentence containing the leak
                cleaned = cleaned.replace(new RegExp(`[^.!?\n]*${pattern.source}[?.]?\\s*`, 'gi'), '').trim();
                console.log(`   🔧 Removed AI phrase: ${pattern.source}`);
            }
        }

        // Convert Markdown → WhatsApp formatting
        cleaned = this._convertToWhatsApp(cleaned);

        // Clean up excessive whitespace only
        cleaned = cleaned.replace(/\n{4,}/g, '\n\n').replace(/  +/g, ' ');

        return cleaned;
    }

    /**
     * Convert Markdown formatting to WhatsApp-native formatting
     * Gemini outputs Markdown by default — WhatsApp uses different syntax
     */
    _convertToWhatsApp(text) {
        let converted = text;

        // 1. Convert **bold** → *bold* (double asterisks → single)
        //    Must do this BEFORE handling single asterisks
        converted = converted.replace(/\*\*(.+?)\*\*/g, '*$1*');

        // 2. Convert ### Header / ## Header / # Header → *Header* with emoji if missing
        converted = converted.replace(/^#{1,3}\s+(.+)$/gm, '*$1*');

        // 3. Convert Markdown bullet points (- item or * item at start of line) → • item
        //    Be careful not to break WhatsApp bold (*text*)
        converted = converted.replace(/^[-]\s+/gm, '• ');
        converted = converted.replace(/^\*\s+(?!\*)/gm, '• ');

        // 4. Remove horizontal rules (--- or ***) — these show as literal text on WhatsApp
        converted = converted.replace(/^[-*]{3,}\s*$/gm, '');

        // 5. Clean up empty lines left behind
        converted = converted.replace(/\n{3,}/g, '\n\n');

        return converted.trim();
    }
    /**
     * Strip URLs from a response
     * Used when search wasn't explicitly requested — keeps replies as pure text
     */
    _stripLinks(response) {
        // Remove full URLs (http/https)
        let cleaned = response.replace(/https?:\/\/\S+/gi, '').trim();
        // Remove orphaned link labels like "Check this: " or "Source: " left behind
        cleaned = cleaned.replace(/(check this|source|link|see|visit|read more|more info|reference)\s*:\s*$/gim, '').trim();
        // Clean up double spaces and trailing punctuation artifacts
        cleaned = cleaned.replace(/  +/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
        return cleaned;
    }
}

module.exports = new ChatBrain();
