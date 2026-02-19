/**
 * Vision Brain
 * Image understanding using Gemini's multimodal API
 * Supports: OCR, image description, meme reading, screenshot analysis
 * Uses the same GEMINI_API_KEY already in .env
 */

class VisionBrain {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.models = [
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-1.5-flash'
        ];
        console.log('👁️ Vision Brain initialized (Gemini Multimodal)');
    }

    /**
     * Process an image message
     * @param {Buffer} imageBuffer - Raw image data
     * @param {string} caption - Optional caption/question from user
     * @param {Object} options - { isGroup, contactId }
     * @returns {{ response: string, source: string }}
     */
    async process(imageBuffer, caption = '', options = {}) {
        const { isGroup = false } = options;

        if (!this.apiKey) {
            return {
                response: "can't process images rn, gemini key not set 😅",
                source: 'vision-brain/no-key',
                isQuickResponse: true
            };
        }

        if (!imageBuffer || imageBuffer.length === 0) {
            return {
                response: "couldn't read that image, try sending again? 🤔",
                source: 'vision-brain/no-image',
                isQuickResponse: true
            };
        }

        const base64Image = imageBuffer.toString('base64');
        const mimeType = this._detectMimeType(imageBuffer);

        // Build the prompt based on whether user asked a question
        let userPrompt;
        if (caption && caption.trim().length > 0) {
            userPrompt = caption.trim();
        } else {
            userPrompt = 'Analyze this image thoroughly. If it contains text, read ALL the text (OCR). If it\'s a meme, explain the humor. If it\'s a screenshot, describe what\'s shown. If it\'s a photo, describe what you see. Be natural and conversational.';
        }

        const systemPrompt = `You are Manthan, a 23-year-old software engineer. You're texting on WhatsApp. Someone sent you an image. 
Respond naturally as Manthan would — casual, witty, helpful.
- If the image has text (screenshot, document, meme), read and interpret ALL the text
- If someone asks a question about the image, answer it directly
- Keep it ${isGroup ? 'very short (1-2 sentences)' : 'concise but helpful'}
- Use Hinglish naturally if appropriate
- NEVER say "I am an AI" or "As an AI"
- NEVER say "I can see an image" — just respond as if you looked at it naturally`;

        const requestBody = {
            contents: [{
                parts: [
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Image
                        }
                    },
                    { text: userPrompt }
                ]
            }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                temperature: 0.7,
                topP: 0.9,
                maxOutputTokens: isGroup ? 128 : 512
            },
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
                    console.log(`   👁️ Vision: ${model} analyzed image (${(imageBuffer.length / 1024).toFixed(1)}KB)`);
                    return {
                        response: response.trim(),
                        source: `vision-brain/${model}`,
                        isQuickResponse: false
                    };
                }
            } catch (error) {
                console.error(`   ❌ Vision [${model}] failed: ${error.message}`);
            }
        }

        // All models failed
        return {
            response: "can't make out that image rn 😅 try sending it again or describe what's in it?",
            source: 'vision-brain/failed',
            isQuickResponse: true
        };
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
            signal: AbortSignal.timeout(25000) // 25s timeout for image processing
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
     * Detect image MIME type from buffer magic bytes
     */
    _detectMimeType(buffer) {
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image/jpeg';
        if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
        if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif';
        if (buffer[0] === 0x52 && buffer[1] === 0x49) return 'image/webp';
        return 'image/jpeg'; // Default fallback
    }
}

module.exports = new VisionBrain();
