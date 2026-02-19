/**
 * Brain Router v5.0
 * Multi-Brain Architecture - Routes messages to specialized brains
 * Now with: Link Preview, Music, Translation, Games, Finance
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
const linkBrain = require('./link-brain');
const musicBrain = require('./music-brain');
const translateBrain = require('./translate-brain');
const gamesBrain = require('./games-brain');
const financeBrain = require('./finance-brain');
const newsBrain = require('./news-brain');
const jokeBrain = require('./joke-brain');
const visionBrain = require('./vision-brain');
const memeBrain = require('./meme-brain');
const todoBrain = require('./todo-brain');
const humanizer = require('./humanizer');
const summarizer = require('../engines/summarizer');
const abTesting = require('../engines/ab-testing');
const reminderEngine = require('../engines/reminder-engine');
const analyticsEngine = require('../engines/analytics-engine');

class BrainRouter {
    constructor() {
        this._lastMessageTime = new Map();

        console.log('🧠 Brain Router v6.0 initialized with Multi-Brain Architecture');
        console.log('   ├─ 💬 Chat Brain (Gemini AI)');
        console.log('   ├─ 📚 Knowledge Brain (NLP + KB)');
        console.log('   ├─ 🔍 Search Brain (DuckDuckGo)');
        console.log('   ├─ 📹 YouTube Brain');
        console.log('   ├─ 🔗 Link Preview Brain');
        console.log('   ├─ 🎵 Music Brain');
        console.log('   ├─ 🌐 Translation Brain (Gemini)');
        console.log('   ├─ 🎮 Games Brain');
        console.log('   ├─ 💰 Finance Brain (CoinGecko)');
        console.log('   ├─ 📰 News Brain (Google News)');
        console.log('   ├─ 😂 Joke Brain (JokeAPI)');
        console.log('   ├─ 👁️ Vision Brain (Gemini Vision)');
        console.log('   ├─ 🖼️ Meme Brain (Reddit)');
        console.log('   ├─ 🤝 Social Brain');
        console.log('   ├─ 🛡️ Safety Brain');
        console.log('   ├─ ⏰ Reminder Engine');
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
        const { isGroup = false, phoneNumber = '', voiceRequest = false, imageBuffer = null, imageCaption = '', quotedText = '' } = options;

        const startTime = Date.now();

        // ═══ IMAGE PROCESSING (highest priority) ═══
        if (imageBuffer) {
            console.log(`   👁️ Image message detected (${(imageBuffer.length / 1024).toFixed(1)}KB)`);
            try {
                const result = await visionBrain.process(imageBuffer, imageCaption || message, { isGroup, contactId });
                if (result && result.response) {
                    // Safety filter
                    result.response = safetyBrain.filter(result.response, imageCaption || 'image', { primary: 'image_analysis' });
                    // Humanize
                    result.response = humanizer.humanize(result.response, {
                        isGroup,
                        timeContext: config.getTimeContext()
                    });
                    result.typingDelay = humanizer.getTypingDelay(result.response, { isGroup, timeContext: config.getTimeContext() });
                    // Store
                    memoryStore.addConversationMessage(contactId, 'user', `[image] ${imageCaption || ''}`, { isGroup });
                    memoryStore.addConversationMessage(contactId, 'assistant', result.response, { isGroup });
                    // Analytics
                    const processingTime = Date.now() - startTime;
                    analyticsEngine.record({ contactId, intent: 'image_analysis', brain: 'vision', responseTime: processingTime, isGroup });
                    return { ...result, processingTime, intent: { primary: 'image_analysis' } };
                }
            } catch (error) {
                console.error(`   ❌ Vision Brain error: ${error.message}`);
            }
        }

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
        const routingDecision = this._route(intent, emotion, isGroup, message, contactId);
        console.log(`   🧠 Routing to: ${routingDecision.brain} (reason: ${routingDecision.reason})`);

        // ═══ STEP 5: Get A/B Test Config Overrides ═══
        const abOverrides = abTesting.getConfigOverrides(contactId);

        // ═══ STEP 6: Generate Response ═══
        let result;

        try {
            switch (routingDecision.brain) {
                case 'games':
                    result = gamesBrain.process(message, contactId);
                    break;

                case 'reminder':
                    result = reminderEngine.process(message, contactId);
                    break;

                case 'news':
                    result = await newsBrain.process(message, isGroup);
                    break;

                case 'joke':
                    result = await jokeBrain.process(message, isGroup);
                    break;

                case 'todo':
                    result = await todoBrain.process(message, contactId);
                    break;

                case 'meme':
                    result = await memeBrain.process(message, isGroup);
                    break;

                case 'summarize': {
                    const summary = await summarizer.summarize(contactId);
                    if (summary && summary.summary) {
                        result = {
                            response: `📝 *Chat Summary*\n━━━━━━━━━━━━━━━━━━━━\n\n${summary.summary}\n\n📊 _${summary.messageCount} messages analyzed_${summary.keyTopics?.length ? '\n🏷️ Topics: ' + summary.keyTopics.join(', ') : ''}`,
                            source: 'summarizer',
                            isQuickResponse: false
                        };
                    } else {
                        result = {
                            response: "not enough chat history to summarize yet 🤷‍♂️ keep chatting and I'll be able to give you a recap",
                            source: 'summarizer/empty',
                            isQuickResponse: true
                        };
                    }
                    break;
                }

                case 'link':
                    result = await linkBrain.process(message, isGroup);
                    if (!result) {
                        result = await chatBrain.process(contactId, message, {
                            isGroup, intent, emotion, personMemory, isNewContact,
                            conversationRecap, abOverrides
                        });
                    }
                    break;

                case 'translate':
                    result = await translateBrain.process(message, isGroup);
                    break;

                case 'music':
                    result = await musicBrain.process(message, isGroup);
                    if (!result) {
                        result = await chatBrain.process(contactId, message, {
                            isGroup, intent, emotion, personMemory, isNewContact,
                            conversationRecap, abOverrides
                        });
                    }
                    break;

                case 'finance':
                    result = await financeBrain.process(message, isGroup);
                    break;

                case 'search':
                    result = await searchBrain.process(message, intent, isGroup);
                    if (!result) {
                        result = await chatBrain.process(contactId, message, {
                            isGroup, intent, emotion, personMemory, isNewContact,
                            conversationRecap, abOverrides
                        });
                    }
                    break;

                case 'youtube':
                    result = await youtubeBrain.process(message, isGroup);
                    if (!result) {
                        result = await chatBrain.process(contactId, message, {
                            isGroup, intent, emotion, personMemory, isNewContact,
                            conversationRecap, abOverrides
                        });
                    }
                    break;

                case 'knowledge':
                    result = await knowledgeBrain.process(message, intent);
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
                        conversationRecap, abOverrides, quotedText
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
        this._lastMessageTime.set(contactId, Date.now());

        const processingTime = Date.now() - startTime;
        console.log(`   ⚡ Processed in ${processingTime}ms via ${result?.source || 'unknown'}`);

        // ═══ Analytics tracking ═══
        analyticsEngine.record({
            contactId,
            intent: intent.primary,
            brain: routingDecision.brain,
            responseTime: processingTime,
            isGroup
        });

        return {
            ...result,
            intent,
            emotion,
            processingTime,
            voiceRequested: voiceRequest
        };
    }

    /**
     * Brain routing logic v5.0
     * Includes: Games, Reminder, Link, Translate, Music, Finance, Search, YouTube
     */
    _route(intent, emotion, isGroup, message, contactId) {
        // ACTIVE GAME SESSION → Games Brain (highest priority)
        if (contactId && gamesBrain.hasActiveGame(contactId)) {
            return { brain: 'games', reason: 'active game session' };
        }

        // SPAM → Social Brain
        if (intent.primary === 'spam') {
            return { brain: 'social', reason: 'spam detected' };
        }

        // Todo / task list requests (check before reminder since patterns overlap)
        if (todoBrain.isTodoRequest(message)) {
            return { brain: 'todo', reason: 'todo request' };
        }

        // Reminder requests
        if (reminderEngine.isReminderRequest(message)) {
            return { brain: 'reminder', reason: 'reminder request' };
        }

        // Game requests
        if (gamesBrain.isGameRequest(message)) {
            return { brain: 'games', reason: 'game request' };
        }

        // Translation requests
        if (translateBrain.isTranslateRequest(message)) {
            return { brain: 'translate', reason: 'translation request' };
        }

        // Finance/crypto/stock requests
        if (financeBrain.isFinanceRequest(message)) {
            return { brain: 'finance', reason: 'finance request' };
        }

        // News requests
        if (newsBrain.isNewsRequest(message)) {
            return { brain: 'news', reason: 'news request' };
        }

        // Joke requests
        if (jokeBrain.isJokeRequest(message)) {
            return { brain: 'joke', reason: 'joke request' };
        }

        // Meme requests
        if (memeBrain.isMemeRequest(message)) {
            return { brain: 'meme', reason: 'meme request' };
        }

        // Summarize requests
        if (this._isSummarizeRequest(message)) {
            return { brain: 'summarize', reason: 'summary request' };
        }

        // Music requests (before YouTube to catch song-specific queries)
        if (musicBrain.isMusicRequest(message)) {
            return { brain: 'music', reason: 'music request' };
        }

        // YouTube requests
        if (youtubeBrain.isYouTubeRequest(message)) {
            return { brain: 'youtube', reason: 'youtube request detected' };
        }

        // Link preview (URL in message)
        if (linkBrain.hasLink(message)) {
            return { brain: 'link', reason: 'URL detected in message' };
        }

        // Web search requests
        if (searchBrain.isSearchRequest(message, intent)) {
            return { brain: 'search', reason: 'search request detected' };
        }

        // Quick social responses
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
     * Check if message is a summarize/recap request
     */
    _isSummarizeRequest(message) {
        const msg = message.toLowerCase();
        return /\b(summarize|summary|summarise|recap|tldr|tl;dr|what did we talk about|chat summary|conversation summary|sum up)\b/i.test(msg);
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
