/**
 * Brain Router v4.1
 * Multi-Brain Architecture - Routes messages to specialized brains
 * 
 * ┌──────────────────┐
 * │   Router Brain    │ ← Decides which brain handles this
 * ├──────┬─────┬──────┤
 * │ Chat │Know │Search│
 * │ Brain│Brain│Brain │ ← Specialized response generation
 * ├──────┼─────┼──────┤
 * │Social│ YT  │Voice │
 * │Brain │Brain│Engine│
 * ├──────┴─────┴──────┤
 * │   Safety Brain     │ ← Always runs last (filter)
 * ├────────────────────┤
 * │ Summarizer + A/B   │ ← Background intelligence
 * └────────────────────┘
 */

const config = require('../utils/config-loader');
const memoryStore = require('../memory/memory-store');
const intentEngine = require('../intelligence/intent-engine');
const emotionEngine = require('../intelligence/emotion-engine');
const chatBrain = require('./chat-brain');
const knowledgeBrain = require('./knowledge-brain');
const socialBrain = require('./social-brain');
const safetyBrain = require('./safety-brain');
const searchBrain = require('./search-brain');
const youtubeBrain = require('./youtube-brain');
const humanizer = require('./humanizer');
const summarizer = require('../engines/summarizer');
const abTesting = require('../engines/ab-testing');

class BrainRouter {
    constructor() {
        // Track last message timestamps for A/B engagement tracking
        this._lastMessageTime = new Map();

        console.log('🧠 Brain Router v4.1 initialized with Multi-Brain Architecture');
        console.log('   ├─ 💬 Chat Brain (Gemini AI)');
        console.log('   ├─ 📚 Knowledge Brain (NLP + KB)');
        console.log('   ├─ 🔍 Search Brain (DuckDuckGo)');
        console.log('   ├─ 📹 YouTube Brain');
        console.log('   ├─ 🤝 Social Brain');
        console.log('   ├─ 🛡️ Safety Brain');
        console.log('   ├─ 📝 Conversation Summarizer');
        console.log('   └─ 🧪 A/B Testing Engine');
    }

    /**
     * Process an incoming message through the full intelligence pipeline
     * 
     * Flow:
     * 1. A/B Engagement tracking (from previous message)
     * 2. Intent + Emotion Detection (NLP)
     * 3. Memory Fetch (Context + Person)
     * 4. Conversation Summarization (if long)
     * 5. Brain Routing Decision
     * 6. Selected Brain generates response (with A/B overrides)
     * 7. Safety Brain filters
     * 8. Humanizer adjusts tone/delay
     * 9. Store + return
     */
    async process(contactId, message, options = {}) {
        const { isGroup = false, phoneNumber = '', voiceRequest = false } = options;

        const startTime = Date.now();

        // ═══ STEP 0: A/B Engagement Tracking ═══
        // If user replied to a previous bot message, that's engagement data
        const lastTime = this._lastMessageTime.get(contactId);
        if (lastTime) {
            const replyTimeMs = startTime - lastTime;
            const quickReplyBonus = replyTimeMs < 60000 ? 'positive' : 'neutral';
            abTesting.recordEngagement(contactId, replyTimeMs, quickReplyBonus);
        }

        // ═══ STEP 1: Intent + Emotion Analysis ═══
        const intent = intentEngine.analyze(message);
        const emotion = emotionEngine.detect(message);

        console.log(`   🎯 Intent: ${intent.primary} (${intent.subIntent || '-'}) | Confidence: ${(intent.confidence * 100).toFixed(0)}%`);
        console.log(`   💭 Emotion: ${emotion.primary} (${emotion.intensity}) | Language: ${intent.language}`);

        // ═══ STEP 2: Memory Operations ═══
        memoryStore.updatePersonMemory(contactId, {
            phoneNumber,
            displayName: phoneNumber
        });

        memoryStore.learnPersonStyle(contactId, message);

        if (emotion.primary !== 'neutral') {
            memoryStore.recordEmotion(contactId, emotion);
        }

        memoryStore.addConversationMessage(contactId, 'user', message, {
            emotion: emotion.primary,
            intent: intent.primary,
            isGroup
        });

        const personMemory = memoryStore.getPersonMemory(contactId);
        const isNewContact = memoryStore.isNewContact(contactId);

        // ═══ STEP 3: Conversation Summary (if long) ═══
        let conversationRecap = '';
        try {
            conversationRecap = await summarizer.getContextRecap(contactId);
            if (conversationRecap) {
                console.log(`   📝 Conversation summary injected (${conversationRecap.length} chars)`);
            }
        } catch (e) {
            // Non-critical
        }

        // ═══ STEP 4: Route to Brain ═══
        const routingDecision = this._route(intent, emotion, isGroup, message);
        console.log(`   🧠 Routing to: ${routingDecision.brain} (reason: ${routingDecision.reason})`);

        // ═══ STEP 5: Get A/B Test Config Overrides ═══
        const abOverrides = abTesting.getConfigOverrides(contactId);

        // ═══ STEP 6: Generate Response ═══
        let result;

        try {
            switch (routingDecision.brain) {
                case 'search':
                    result = await searchBrain.process(message, intent, isGroup);
                    // If search returned nothing, fall through to chat
                    if (!result) {
                        result = await chatBrain.process(contactId, message, {
                            isGroup, intent, emotion, personMemory, isNewContact,
                            conversationRecap, abOverrides
                        });
                    }
                    break;

                case 'youtube':
                    result = await youtubeBrain.process(message, isGroup);
                    // If YouTube returned nothing, fall through to chat
                    if (!result) {
                        result = await chatBrain.process(contactId, message, {
                            isGroup, intent, emotion, personMemory, isNewContact,
                            conversationRecap, abOverrides
                        });
                    }
                    break;

                case 'knowledge':
                    result = await knowledgeBrain.process(message, intent);
                    // Knowledge brain may return null, fall through to chat
                    if (!result) {
                        result = await chatBrain.process(contactId, message, {
                            isGroup, intent, emotion, personMemory, isNewContact,
                            conversationRecap, abOverrides
                        });
                    }
                    break;

                case 'social':
                    result = await socialBrain.process(message, intent, emotion, isGroup);
                    break;

                case 'chat':
                default:
                    result = await chatBrain.process(contactId, message, {
                        isGroup, intent, emotion, personMemory, isNewContact,
                        conversationRecap, abOverrides
                    });
                    break;
            }
        } catch (error) {
            console.error(`   ❌ ${routingDecision.brain} Brain failed:`, error.message);

            // Fallback chain: knowledge → social → hardcoded
            result = await knowledgeBrain.process(message, intent);
            if (!result) {
                result = socialBrain.process(message, intent, emotion, isGroup);
            }
            if (!result) {
                result = {
                    response: this._getEmergencyFallback(intent, emotion),
                    source: 'emergency-fallback',
                    isQuickResponse: true
                };
            }
        }

        // ═══ STEP 7: Safety Filter ═══
        if (result && result.response) {
            result.response = safetyBrain.filter(result.response, message, intent);
        }

        // ═══ STEP 8: Humanize ═══
        if (result && result.response) {
            result.response = humanizer.humanize(result.response, {
                isGroup,
                emotion,
                intent,
                personMemory,
                timeContext: config.getTimeContext()
            });

            result.typingDelay = humanizer.getTypingDelay(result.response, {
                isGroup,
                intent,
                timeContext: config.getTimeContext()
            });
        }

        // ═══ STEP 9: Store response + track timing ═══
        if (result && result.response) {
            memoryStore.addConversationMessage(contactId, 'assistant', result.response, {
                isGroup
            });
        }

        // Track timestamp for A/B engagement
        this._lastMessageTime.set(contactId);
        this._lastMessageTime.set(contactId, Date.now());

        const processingTime = Date.now() - startTime;
        console.log(`   ⚡ Processed in ${processingTime}ms via ${result?.source || 'unknown'}`);

        return {
            ...result,
            intent,
            emotion,
            processingTime,
            voiceRequested: voiceRequest
        };
    }

    /**
     * Brain routing logic v4.1
     * Now includes Search and YouTube brains
     */
    _route(intent, emotion, isGroup, message) {
        // SPAM → Social Brain (short dismissal)
        if (intent.primary === 'spam') {
            return { brain: 'social', reason: 'spam detected' };
        }

        // YouTube requests
        if (youtubeBrain.isYouTubeRequest(message)) {
            return { brain: 'youtube', reason: 'youtube request detected' };
        }

        // Web search requests
        if (searchBrain.isSearchRequest(message, intent)) {
            return { brain: 'search', reason: 'search request detected' };
        }

        // Quick social responses (greetings, thanks, farewells)
        if (['greeting', 'farewell', 'thanks', 'birthday', 'festival'].includes(intent.primary)) {
            return { brain: 'social', reason: 'social intent' };
        }

        // Knowledge requests about Manthan
        if (['about_inquiry', 'work_inquiry', 'tech_inquiry', 'contact_inquiry'].includes(intent.primary)) {
            return { brain: 'knowledge', reason: 'knowledge intent' };
        }

        // Factual questions that might need search
        if (intent.primary === 'question' && intent.subIntent === 'factual') {
            if (!/manthan|your|you|tum|aap/i.test(message)) {
                return { brain: 'search', reason: 'factual question (non-personal)' };
            }
        }

        // Everything else → Chat Brain (LLM)
        return { brain: 'chat', reason: 'general conversation' };
    }

    /**
     * Emergency fallback when all brains fail
     */
    _getEmergencyFallback(intent, emotion) {
        const fallbacks = [
            "hmm let me think about this for a sec",
            "acha wait, I'll get back on this properly",
            "sorry yaar, brain freeze 😅 text me again in a bit?",
            "one sec, processing... (my brain, not a computer lol)",
            "interesting question. let me check and get back to you"
        ];

        if (emotion.primary === 'sad' || emotion.primary === 'anxious') {
            return "hey, I hear you. let me give you a proper response in a bit 🙏";
        }

        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    /**
     * Get A/B test report
     */
    getABReport() {
        return abTesting.getReport();
    }

    /**
     * Get daily conversation digest
     */
    async getDailyDigest() {
        return await summarizer.getDailyDigest();
    }
}

module.exports = new BrainRouter();
