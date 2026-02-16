/**
 * Translation Brain
 * Translates text using Gemini AI (free API)
 * 
 * Capabilities:
 * - "translate <text> to Hindi"
 * - "translate <text> to English"
 * - Auto-detect source language
 * - Supports 50+ languages
 */

class TranslateBrain {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.translatePatterns = [
            /\b(translate|translation|convert)\b/i,
            /\b(hindi mein|english mein|in hindi|in english|in spanish|in french|in german|in japanese|in korean|in chinese|in arabic|in marathi|in tamil|in telugu|in bengali|in gujarati|in punjabi|in urdu)\b/i
        ];

        this.languageMap = {
            'hindi': 'Hindi', 'english': 'English', 'spanish': 'Spanish',
            'french': 'French', 'german': 'German', 'japanese': 'Japanese',
            'korean': 'Korean', 'chinese': 'Chinese (Simplified)', 'arabic': 'Arabic',
            'marathi': 'Marathi', 'tamil': 'Tamil', 'telugu': 'Telugu',
            'bengali': 'Bengali', 'gujarati': 'Gujarati', 'punjabi': 'Punjabi',
            'urdu': 'Urdu', 'portuguese': 'Portuguese', 'russian': 'Russian',
            'italian': 'Italian', 'dutch': 'Dutch', 'turkish': 'Turkish',
            'thai': 'Thai', 'vietnamese': 'Vietnamese', 'indonesian': 'Indonesian',
            'malay': 'Malay', 'kannada': 'Kannada', 'malayalam': 'Malayalam',
            'odia': 'Odia', 'assamese': 'Assamese', 'nepali': 'Nepali',
            'sinhala': 'Sinhala', 'swahili': 'Swahili'
        };

        console.log('🌐 Translation Brain initialized');
    }

    /**
     * Check if message is a translation request
     */
    isTranslateRequest(message) {
        return this.translatePatterns.some(p => p.test(message));
    }

    /**
     * Process a translation request
     */
    async process(message, isGroup = false) {
        const parsed = this._parseRequest(message);
        if (!parsed) {
            return {
                response: "🌐 I can translate! Try:\n• _translate hello to Hindi_\n• _translate namaste to English_\n• _translate bonjour to Japanese_",
                source: 'translate-brain/help',
                isQuickResponse: true
            };
        }

        const { text, targetLang } = parsed;

        if (!this.apiKey) {
            // Fallback without API — use Google Translate link
            const encodedText = encodeURIComponent(text);
            const targetCode = this._getLangCode(targetLang);
            const link = `https://translate.google.com/?sl=auto&tl=${targetCode}&text=${encodedText}`;
            return {
                response: `🌐 Translation:\n🔗 ${link}\n\n_Gemini API key not set, using Google Translate link_`,
                source: 'translate-brain/link',
                isQuickResponse: true
            };
        }

        try {
            const translated = await this._translateWithGemini(text, targetLang);

            const response = isGroup
                ? `🌐 *${targetLang}:* ${translated}`
                : `🌐 *Translation to ${targetLang}:*\n\n📝 Original: ${text}\n✅ Translated: ${translated}`;

            return {
                response,
                source: 'translate-brain',
                isQuickResponse: true
            };
        } catch (error) {
            console.error('   ❌ Translation error:', error.message);

            // Fallback to Google Translate link
            const encodedText = encodeURIComponent(text);
            const targetCode = this._getLangCode(targetLang);
            const link = `https://translate.google.com/?sl=auto&tl=${targetCode}&text=${encodedText}`;
            return {
                response: `🌐 Translation link: ${link}`,
                source: 'translate-brain/fallback',
                isQuickResponse: true
            };
        }
    }

    /**
     * Use Gemini to translate
     */
    async _translateWithGemini(text, targetLang) {
        const prompt = `Translate the following text to ${targetLang}. Return ONLY the translated text, nothing else. No explanation, no notes.\n\nText: "${text}"`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 500
                    }
                }),
                signal: AbortSignal.timeout(10000)
            }
        );

        if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

        const data = await response.json();
        const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!result) throw new Error('Empty response from Gemini');

        return result.replace(/^["']|["']$/g, '').trim();
    }

    /**
     * Parse translation request
     */
    _parseRequest(message) {
        // Pattern: "translate X to/in language"
        let match = message.match(/translate\s+(.+?)\s+(?:to|in|into)\s+(\w+)/i);
        if (match) {
            const targetLang = this._findLanguage(match[2]);
            if (targetLang) return { text: match[1].trim(), targetLang };
        }

        // Pattern: "X ko hindi mein translate karo"
        match = message.match(/(.+?)\s+(?:ko|ka|ki)\s+(\w+)\s+(?:mein|me|main)\s+(?:translate|convert)/i);
        if (match) {
            const targetLang = this._findLanguage(match[2]);
            if (targetLang) return { text: match[1].trim(), targetLang };
        }

        // Pattern: "translate X" (default to English)
        match = message.match(/translate\s+(.+)/i);
        if (match) {
            const text = match[1].trim();
            // Check if text has Hindi chars → translate to English
            if (/[\u0900-\u097F]/.test(text)) {
                return { text, targetLang: 'English' };
            }
            return { text, targetLang: 'Hindi' }; // Default: translate to Hindi
        }

        // Pattern: "X in hindi"
        match = message.match(/(.+?)\s+in\s+(\w+)$/i);
        if (match) {
            const targetLang = this._findLanguage(match[2]);
            if (targetLang) return { text: match[1].trim(), targetLang };
        }

        return null;
    }

    _findLanguage(input) {
        const key = input.toLowerCase();
        return this.languageMap[key] || null;
    }

    _getLangCode(langName) {
        const codes = {
            'Hindi': 'hi', 'English': 'en', 'Spanish': 'es', 'French': 'fr',
            'German': 'de', 'Japanese': 'ja', 'Korean': 'ko', 'Chinese (Simplified)': 'zh-CN',
            'Arabic': 'ar', 'Marathi': 'mr', 'Tamil': 'ta', 'Telugu': 'te',
            'Bengali': 'bn', 'Gujarati': 'gu', 'Punjabi': 'pa', 'Urdu': 'ur',
            'Portuguese': 'pt', 'Russian': 'ru', 'Italian': 'it', 'Dutch': 'nl',
            'Turkish': 'tr', 'Thai': 'th', 'Vietnamese': 'vi', 'Indonesian': 'id',
            'Malay': 'ms', 'Kannada': 'kn', 'Malayalam': 'ml', 'Odia': 'or',
            'Assamese': 'as', 'Nepali': 'ne', 'Sinhala': 'si', 'Swahili': 'sw'
        };
        return codes[langName] || 'en';
    }
}

module.exports = new TranslateBrain();
