/**
 * Emotion Engine
 * Detects emotional state from messages
 * Used to adjust AI response tone and style
 */

class EmotionEngine {
    constructor() {
        this.emotionPatterns = {
            happy: {
                keywords: ['happy', 'great', 'amazing', 'awesome', 'wonderful', 'fantastic', 'love', 'loved', 'best', 'perfect', 'excellent', 'khush', 'mast', 'badhiya', 'sahi'],
                emojis: ['😊', '😁', '😄', '🥳', '🎉', '❤️', '💯', '🔥', '👍', '😍', '🤩', '💪'],
                weight: 1.0
            },
            excited: {
                keywords: ['excited', 'cant wait', 'omg', 'incredible', 'insane', 'crazy good', 'lit', 'letsgoo', 'lets go', 'fire', 'epic', 'zabardast'],
                emojis: ['🔥', '🚀', '💥', '⚡', '🤯', '😱'],
                weight: 1.2
            },
            sad: {
                keywords: ['sad', 'upset', 'cry', 'crying', 'miss', 'missing', 'alone', 'lonely', 'depressed', 'depression', 'dukhi', 'rona', 'akela', 'hurt'],
                emojis: ['😢', '😭', '💔', '😞', '😔', '🥺'],
                weight: 1.5
            },
            frustrated: {
                keywords: ['frustrated', 'annoyed', 'irritated', 'stuck', 'nothing works', 'fed up', 'tired of', 'bore', 'pakk gaya', 'thak gaya', 'enough', 'ugh'],
                emojis: ['😤', '😠', '🤬', '💢'],
                weight: 1.3
            },
            angry: {
                keywords: ['angry', 'mad', 'furious', 'stupid', 'idiot', 'worst', 'terrible', 'disgusting', 'hate', 'bakwas', 'ghatiya', 'bekar'],
                emojis: ['😡', '🤬', '💢', '👊'],
                weight: 1.4
            },
            confused: {
                keywords: ['confused', 'dont understand', 'what do you mean', 'unclear', 'lost', 'samajh nahi', 'kya matlab', 'huh', 'explain', 'wait what'],
                emojis: ['🤔', '😕', '😐', '❓', '🧐'],
                weight: 1.0
            },
            curious: {
                keywords: ['curious', 'interesting', 'tell me more', 'how', 'why', 'what if', 'really', 'seriously', 'sach mein', 'acha', 'achha'],
                emojis: ['🤔', '👀', '💡', '🧠'],
                weight: 0.8
            },
            grateful: {
                keywords: ['thank', 'thanks', 'grateful', 'appreciate', 'means a lot', 'helpful', 'dhanyawad', 'shukriya', 'bohot acha'],
                emojis: ['🙏', '❤️', '😊', '🥰'],
                weight: 0.9
            },
            anxious: {
                keywords: ['worried', 'anxious', 'nervous', 'scared', 'fear', 'panic', 'tension', 'stress', 'stressed', 'dar', 'pareshan'],
                emojis: ['😰', '😨', '😱', '🥶'],
                weight: 1.3
            },
            sarcastic: {
                keywords: ['sure', 'right', 'okay', 'whatever', 'obviously', 'wow genius', 'no shit', 'as if', 'haan haan'],
                emojis: ['🙄', '😏', '🤡', '💀'],
                weight: 1.1
            },
            challenging: {
                keywords: ['prove', 'bet', 'wrong', 'disagree', 'nah', 'fake', 'cap', 'galat', 'jhooth', 'nonsense', 'impossible'],
                emojis: ['😤', '🤨', '👎'],
                weight: 1.2
            },
            neutral: {
                keywords: [],
                emojis: [],
                weight: 0.3
            }
        };

        console.log('💭 Emotion Engine initialized');
    }

    /**
     * Detect emotion from a message
     * @returns {{ primary: string, secondary: string|null, intensity: string, confidence: number, scores: Object }}
     */
    detect(message) {
        const msg = message.toLowerCase();
        const scores = {};

        // Score each emotion
        for (const [emotion, config] of Object.entries(this.emotionPatterns)) {
            let score = 0;

            // Keyword matching
            for (const keyword of config.keywords) {
                if (msg.includes(keyword)) {
                    score += config.weight;
                }
            }

            // Emoji matching
            for (const emoji of config.emojis) {
                if (message.includes(emoji)) {
                    score += config.weight * 0.8;
                }
            }

            scores[emotion] = score;
        }

        // Detect via sentence patterns
        scores.frustrated += this._detectFrustrationPatterns(msg);
        scores.excited += this._detectExcitementPatterns(msg, message);
        scores.sad += this._detectSadnessPatterns(msg);

        // Find primary and secondary emotions
        const sorted = Object.entries(scores)
            .filter(([k]) => k !== 'neutral')
            .sort((a, b) => b[1] - a[1]);

        const primary = sorted[0]?.[1] > 0 ? sorted[0][0] : 'neutral';
        const secondary = sorted[1]?.[1] > 0 ? sorted[1][0] : null;
        const topScore = sorted[0]?.[1] || 0;

        // Determine intensity
        let intensity = 'low';
        if (topScore > 3) intensity = 'high';
        else if (topScore > 1.5) intensity = 'medium';

        // Confidence
        const confidence = Math.min(topScore / 4, 1.0);

        return {
            primary,
            secondary,
            intensity,
            confidence,
            scores
        };
    }

    _detectFrustrationPatterns(msg) {
        let score = 0;
        // Repeated punctuation indicates frustration
        if (/[!]{2,}/.test(msg)) score += 0.5;
        if (/[?]{2,}/.test(msg)) score += 0.5;
        // ALL CAPS words
        const words = msg.split(' ');
        const capsWords = words.filter(w => w.length > 2 && w === w.toUpperCase());
        if (capsWords.length > 1) score += 1.0;
        return score;
    }

    _detectExcitementPatterns(msg, original) {
        let score = 0;
        // Multiple exclamation marks
        if (/!{2,}/.test(original)) score += 0.5;
        // Exaggerated words
        if (/soo+|soo+|veryy+|amazingg+|omgg+/.test(msg)) score += 0.7;
        // Multiple emojis
        const emojiCount = (original.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}]/gu) || []).length;
        if (emojiCount > 3) score += 0.5;
        return score;
    }

    _detectSadnessPatterns(msg) {
        let score = 0;
        // Patterns that indicate sadness
        if (/i (feel|am feeling|am) (so )?(sad|low|down|broken)/.test(msg)) score += 1.5;
        if (/nothing (works|matters|is going)/.test(msg)) score += 1.0;
        if (/i (cant|can't|cannot) (take|handle|bear)/.test(msg)) score += 1.2;
        return score;
    }

    /**
     * Get response guidance based on detected emotion
     */
    getResponseGuidance(emotion) {
        const guides = {
            happy: { tone: 'match their energy', length: 'short-medium', emoji: true },
            excited: { tone: 'enthusiastic, match energy', length: 'medium', emoji: true },
            sad: { tone: 'empathetic, supportive, gentle', length: 'medium', emoji: false },
            frustrated: { tone: 'patient, understanding, helpful', length: 'medium', emoji: false },
            angry: { tone: 'calm, grounded, non-defensive', length: 'short', emoji: false },
            confused: { tone: 'clear, explanatory, patient', length: 'medium-long', emoji: false },
            curious: { tone: 'informative, engaging, knowledgeable', length: 'medium-long', emoji: true },
            grateful: { tone: 'warm, humble, friendly', length: 'short', emoji: true },
            anxious: { tone: 'reassuring, calm, supportive', length: 'medium', emoji: false },
            sarcastic: { tone: 'witty, confident, playful', length: 'short', emoji: true },
            challenging: { tone: 'confident, calm, factual', length: 'medium', emoji: false },
            neutral: { tone: 'natural, balanced', length: 'medium', emoji: true }
        };

        return guides[emotion.primary] || guides.neutral;
    }
}

module.exports = new EmotionEngine();
