/**
 * Intent Engine
 * Multi-layer intent + sub-intent + emotion detection
 * Runs BEFORE the LLM to understand the message context
 */

class IntentEngine {
    constructor() {
        // Intent definitions with patterns and sub-intents
        this.intentPatterns = {
            greeting: {
                patterns: [/^(hi|hello|hey|namaste|good morning|good afternoon|good evening|hii+|yo|sup|kya hal|kaise ho|kem cho)/i],
                subIntents: ['morning_greeting', 'casual_hi', 'formal_greeting']
            },
            farewell: {
                patterns: [/^(bye|goodbye|see you|cya|goodnight|night|chalo|chal|tata|alvida)/i],
                subIntents: ['casual_bye', 'goodnight', 'formal_bye']
            },
            question: {
                patterns: [/\?$/, /^(what|how|why|when|where|who|which|can you|could you|tell me|explain|kya|kaise|kyun|kab|kaha|kaun)/i],
                subIntents: ['factual', 'opinion', 'how_to', 'philosophical']
            },
            about_inquiry: {
                patterns: [/(who is|who's|about|tell me about|introduce|manthan kon|kaun|apna intro)/i],
                subIntents: ['personal_info', 'work_info', 'general']
            },
            work_inquiry: {
                patterns: [/(work|job|company|career|profession|kya karte|kaam|developer|engineer|coding|role)/i],
                subIntents: ['current_role', 'skills', 'experience']
            },
            tech_inquiry: {
                patterns: [/(tech|stack|technology|skills|coding|language|react|python|javascript|hadoop|spark)/i],
                subIntents: ['tech_stack', 'learning', 'opinion']
            },
            contact_inquiry: {
                patterns: [/(contact|email|phone|reach|social|youtube|instagram|twitter|linkedin|number)/i],
                subIntents: ['social_media', 'direct_contact', 'professional']
            },
            collaboration: {
                patterns: [/(collaborate|collab|project|work together|partner|opportunity|hire|freelance|job offer)/i],
                subIntents: ['project', 'hiring', 'partnership']
            },
            human_request: {
                patterns: [/(speak|talk|call|chat with manthan|connect me|reach manthan|manthan se baat|real manthan)/i],
                subIntents: ['urgent', 'casual', 'business']
            },
            thanks: {
                patterns: [/(thank|thanks|dhanyawad|shukriya|appreciate|awesome|great|nice|perfect)/i],
                subIntents: ['casual_thanks', 'appreciation']
            },
            birthday: {
                patterns: [/(happy birthday|hbd|many many happy returns|janam din|birthday)/i],
                subIntents: ['wishing', 'asking_date']
            },
            festival: {
                patterns: [/(happy|shubhechha|mubarak).*(diwali|holi|eid|christmas|new year|navratri|festival|sankranti|ganesh|dussehra)/i],
                subIntents: ['wishing', 'asking_about']
            },
            opinion: {
                patterns: [/(what do you think|opinion|views|thoughts|acha lagta|pasand|favorite|best|worst)/i],
                subIntents: ['tech_opinion', 'life_opinion', 'recommendation']
            },
            help: {
                patterns: [/(help|assist|support|problem|issue|error|bug|fix|solve|stuck|please help)/i],
                subIntents: ['technical_help', 'general_help', 'urgent']
            },
            casual: {
                patterns: [/(kya chal|what's up|how's it going|kaise|chal kya|kya haal|batao|bolo|sunao)/i],
                subIntents: ['small_talk', 'catching_up']
            },
            challenge: {
                patterns: [/(prove|bet|dare|challenge|wrong|galat|nonsense|bakwas|fake|fraud)/i],
                subIntents: ['intellectual', 'ego', 'playful']
            },
            request: {
                patterns: [/(can you|could you|please|will you|would you|karo na|kar do|bana do|send|share|show)/i],
                subIntents: ['action', 'information', 'creative']
            },
            emotional: {
                patterns: [/(sad|happy|angry|frustrated|confused|scared|excited|bored|lonely|stressed|anxious|worried|depressed|upset|annoyed)/i],
                subIntents: ['venting', 'seeking_comfort', 'sharing_joy']
            },
            spam: {
                patterns: [/(join|click|earn|win|lottery|prize|offer|discount|free|limited time|hurry|forward|share to)/i],
                subIntents: ['marketing', 'scam', 'chain_message']
            }
        };

        console.log('🎯 Intent Engine initialized');
    }

    /**
     * Analyze a message for intents and sub-intents
     * @returns {{ primary: string, subIntent: string, confidence: number, all: Object }}
     */
    analyze(message) {
        const msg = message.toLowerCase().trim();
        const results = {};
        let primaryIntent = 'unknown';
        let primaryScore = 0;
        let primarySubIntent = null;

        for (const [intentName, config] of Object.entries(this.intentPatterns)) {
            let matched = false;
            for (const pattern of config.patterns) {
                if (pattern.test(msg)) {
                    matched = true;
                    break;
                }
            }

            results[intentName] = matched;

            if (matched) {
                // Calculate rough confidence based on specificity
                const score = this._calculateConfidence(msg, intentName);
                if (score > primaryScore) {
                    primaryScore = score;
                    primaryIntent = intentName;
                    primarySubIntent = this._detectSubIntent(msg, intentName, config.subIntents);
                }
            }
        }

        return {
            primary: primaryIntent,
            subIntent: primarySubIntent,
            confidence: primaryScore,
            all: results,
            messageLength: msg.length,
            isShort: msg.length < 20,
            isLong: msg.length > 200,
            hasEmoji: /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(message),
            language: this._detectLanguage(msg)
        };
    }

    _calculateConfidence(message, intentName) {
        // More pattern matches = higher confidence
        let score = 0.5;

        const patterns = this.intentPatterns[intentName].patterns;
        for (const pattern of patterns) {
            if (pattern.test(message)) score += 0.15;
        }

        // Short messages with clear intent = higher confidence
        if (message.length < 30) score += 0.1;

        // Specific intents get boosted
        if (['greeting', 'farewell', 'thanks', 'birthday', 'festival'].includes(intentName)) {
            score += 0.1;
        }

        return Math.min(score, 1.0);
    }

    _detectSubIntent(message, intentName, subIntents) {
        if (!subIntents || subIntents.length === 0) return null;

        const msg = message.toLowerCase();

        // Sub-intent detection based on message content
        switch (intentName) {
            case 'greeting':
                if (/morning|good morning/.test(msg)) return 'morning_greeting';
                if (/namaste|sir|madam/.test(msg)) return 'formal_greeting';
                return 'casual_hi';

            case 'question':
                if (/how to|kaise|steps|guide/.test(msg)) return 'how_to';
                if (/what do you think|opinion|views/.test(msg)) return 'opinion';
                if (/why|kyun|reason/.test(msg)) return 'philosophical';
                return 'factual';

            case 'help':
                if (/error|bug|fix|crash|not working/.test(msg)) return 'technical_help';
                if (/urgent|asap|quickly|jaldi/.test(msg)) return 'urgent';
                return 'general_help';

            case 'emotional':
                if (/happy|excited|great|amazing/.test(msg)) return 'sharing_joy';
                if (/sad|upset|depressed|lonely/.test(msg)) return 'seeking_comfort';
                return 'venting';

            case 'challenge':
                if (/bet|dare|prove/.test(msg)) return 'playful';
                if (/wrong|galat|fake/.test(msg)) return 'ego';
                return 'intellectual';

            default:
                return subIntents[0]; // Default to first sub-intent
        }
    }

    _detectLanguage(message) {
        // Hindi/Devanagari script detection
        if (/[\u0900-\u097F]/.test(message)) return 'hindi';

        // Hinglish detection (romanized Hindi words)
        const hinglishWords = /\b(kya|kaise|kyun|hai|hain|ho|nahi|bhai|yaar|bro|matlab|acha|theek|chal|kar|raha|wala|bol|sun|dekh|mein|tum|apna|uska|mera|tera)\b/;
        if (hinglishWords.test(message)) return 'hinglish';

        return 'english';
    }
}

module.exports = new IntentEngine();
