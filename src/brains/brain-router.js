/**
 * Brain Router v6.0 — Simplified & Focused
 * 
 * Core Philosophy:
 *   - Chat Brain (Gemini) handles EVERYTHING by default — like a real human
 *   - Search ONLY when user explicitly says "search" / "google"
 *   - YouTube ONLY when user explicitly mentions "youtube" / "video"
 *   - Translate, Reminder, Todo — kept as useful utilities
 *   - Removed: games, meme, music, finance, news, joke (unnecessary complexity)
 *   - Full conversation context maintained via memory store
 *   - Quoted message handling for "reply to this" feature
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
const translateBrain = require('./translate-brain');
const todoBrain = require('./todo-brain');
const visionBrain = require('./vision-brain');
const humanizer = require('./humanizer');
const summarizer = require('../engines/summarizer');
const reminderEngine = require('../engines/reminder-engine');
const analyticsEngine = require('../engines/analytics-engine');

class BrainRouter {
    constructor() {
        this._lastMessageTime = new Map();

        console.log('🧠 Brain Router v6.0 initialized (Simplified)');
        console.log('   ├─ 💬 Chat Brain (Gemini AI) — handles everything');
        console.log('   ├─ 📚 Knowledge Brain (NLP + KB)');
        console.log('   ├─ 🔍 Search Brain (explicit only)');
        console.log('   ├─ 📹 YouTube Brain (explicit only)');
        console.log('   ├─ 🔗 Link Preview Brain');
        console.log('   ├─ 🌐 Translation Brain');
        console.log('   ├─ 📝 Todo Brain');
        console.log('   ├─ 👁️ Vision Brain');
        console.log('   ├─ ⏰ Reminder Engine');
        console.log('   ├─ 🤝 Social Brain');
        console.log('   ├─ 🛡️ Safety Brain');
        console.log('   └─ 🎭 Humanizer');
    }

    /**
     * Process an incoming message through the intelligence pipeline
     * 
     * Flow:
     * 1. Image → Vision Brain (highest priority)
     * 2. Intent + Emotion Detection
     * 3. Memory Fetch (Context + Person)
     * 4. Conversation Summarization (if long)
     * 5. Brain Routing Decision
     * 6. Selected Brain generates response
     * 7. Safety Filter
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
                    result.response = safetyBrain.filter(result.response, imageCaption || 'image', { primary: 'image_analysis' });
                    result.response = humanizer.humanize(result.response, {
                        isGroup,
                        timeContext: config.getTimeContext()
                    });
                    result.typingDelay = humanizer.getTypingDelay(result.response, { isGroup, timeContext: config.getTimeContext() });
                    memoryStore.addConversationMessage(contactId, 'user', `[image] ${imageCaption || ''}`, { isGroup });
                    memoryStore.addConversationMessage(contactId, 'assistant', result.response, { isGroup });
                    const processingTime = Date.now() - startTime;
                    analyticsEngine.record({ contactId, intent: 'image_analysis', brain: 'vision', responseTime: processingTime, isGroup });
                    return { ...result, processingTime, intent: { primary: 'image_analysis' } };
                }
            } catch (error) {
                console.error(`   ❌ Vision Brain error: ${error.message}`);
            }
        }

        // ═══ STEP 1: Intelligence Analysis ═══
        const intent = intentEngine.analyze(message || imageCaption || '');
        const emotion = emotionEngine.analyze(message || imageCaption || '', contactId);

        console.log(`🎯 Intent: ${intent.primary} | 💭 Emotion: ${emotion.primary} (${emotion.intensity})`);

        // ═══ STEP 2: Memory & Context ═══
        if (phoneNumber) {
            memoryStore.updatePersonMemory(contactId, { phoneNumber });
        }

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
                console.log(`   📝 Context Summary: ${conversationRecap.substring(0, 50)}...`);
            }
        } catch (e) {
            console.error('   ⚠️ Summary failed:', e.message);
        }

        // ═══ STEP 4: Route to Brain ═══
        const routingDecision = this._route(intent, emotion, isGroup, message, contactId);
        console.log(`   🧠 Routing to: ${routingDecision.brain} (reason: ${routingDecision.reason})`);

        // ═══ STEP 5: Generate Response ═══
        const aiContext = {
            isGroup, intent, emotion, personMemory, isNewContact,
            conversationRecap, quotedText, imageBuffer
        };

        let result;

        try {
            switch (routingDecision.brain) {
                case 'reminder':
                    result = reminderEngine.process(message, contactId);
                    break;

                case 'todo':
                    result = await todoBrain.process(message, contactId);
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
                    if (!result) result = await chatBrain.process(contactId, message, aiContext);
                    break;

                case 'translate':
                    result = await translateBrain.process(message, isGroup);
                    break;

                case 'search': {
                    const findings = await searchBrain.process(message, intent, isGroup);
                    result = await chatBrain.process(contactId, message, {
                        ...aiContext,
                        externalFindings: findings?.response || findings
                    });
                    break;
                }

                case 'youtube': {
                    const findings = await youtubeBrain.process(message, isGroup);
                    result = await chatBrain.process(contactId, message, {
                        ...aiContext,
                        externalFindings: findings?.response || findings
                    });
                    break;
                }

                case 'knowledge': {
                    const findings = await knowledgeBrain.process(message, intent);
                    if (findings) {
                        result = await chatBrain.process(contactId, message, {
                            ...aiContext,
                            externalFindings: findings.response
                        });
                    } else {
                        result = await chatBrain.process(contactId, message, aiContext);
                    }
                    break;
                }

                case 'social':
                    result = await socialBrain.process(message, intent, emotion, isGroup);
                    break;

                case 'chat':
                default:
                    result = await chatBrain.process(contactId, message, aiContext);
                    break;
            }
        } catch (error) {
            console.error(`   ❌ ${routingDecision.brain} Brain failed:`, error.message);

            // ═══ SMART FALLBACK ═══
            // If Gemini (chat brain) failed → try answering via web search
            if (routingDecision.brain === 'chat' || routingDecision.brain === 'knowledge') {
                console.log('   🔄 Gemini failed, falling back to web search...');
                try {
                    const searchResult = await searchBrain.process(message, intent, isGroup);
                    if (searchResult && searchResult.response) {
                        result = searchResult;
                        result.source = 'fallback-search';
                    }
                } catch (searchErr) {
                    console.error('   ❌ Fallback search also failed:', searchErr.message);
                }
            }

            // If search fallback also failed → knowledge → social → hardcoded
            if (!result) {
                result = await knowledgeBrain.process(message, intent);
            }
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

        // ═══ STEP 6: Safety Filter ═══
        if (result && result.response) {
            result.response = safetyBrain.filter(result.response, message, intent);
        }

        // ═══ STEP 7: Humanize ═══
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

        // ═══ STEP 8: Store response ═══
        if (result && result.response) {
            memoryStore.addConversationMessage(contactId, 'assistant', result.response, {
                isGroup
            });
        }

        this._lastMessageTime.set(contactId, Date.now());

        const processingTime = Date.now() - startTime;
        console.log(`   ⚡ Processed in ${processingTime}ms via ${result?.source || 'unknown'}`);

        // Analytics tracking
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
     * Brain routing logic v6.0 — SIMPLIFIED
     * 
     * Default: Chat Brain handles everything (like a real person)
     * Only route away for EXPLICIT feature requests
     */
    _route(intent, emotion, isGroup, message, contactId) {
        const msg = message?.toLowerCase() || '';

        // SPAM → Social Brain
        if (intent.primary === 'spam') {
            return { brain: 'social', reason: 'spam detected' };
        }

        // Todo / task list requests
        if (todoBrain.isTodoRequest(message)) {
            return { brain: 'todo', reason: 'todo request' };
        }

        // Reminder requests
        if (reminderEngine.isReminderRequest(message)) {
            return { brain: 'reminder', reason: 'reminder request' };
        }

        // Translation requests
        if (translateBrain.isTranslateRequest(message)) {
            return { brain: 'translate', reason: 'translation request' };
        }

        // Summarize requests
        if (this._isSummarizeRequest(message)) {
            return { brain: 'summarize', reason: 'summary request' };
        }

        // YouTube requests (ONLY when user explicitly mentions youtube/video)
        if (youtubeBrain.isYouTubeRequest(message)) {
            return { brain: 'youtube', reason: 'explicit youtube request' };
        }

        // Link preview (URL in message)
        if (linkBrain.hasLink(message)) {
            return { brain: 'link', reason: 'URL detected in message' };
        }

        // Web search (ONLY when user explicitly says "search" / "google")
        if (searchBrain.isSearchRequest(message, intent)) {
            return { brain: 'search', reason: 'explicit search request' };
        }

        // Birthday/festival — social brain
        if (['birthday', 'festival'].includes(intent.primary)) {
            return { brain: 'social', reason: 'special occasion' };
        }

        // Knowledge requests about Manthan
        if (['about_inquiry', 'work_inquiry', 'tech_inquiry', 'contact_inquiry'].includes(intent.primary)) {
            return { brain: 'knowledge', reason: 'knowledge intent' };
        }

        // Everything else → Chat Brain (LLM) — acts like a real human
        return { brain: 'chat', reason: 'general conversation' };
    }

    _isSummarizeRequest(message) {
        const msg = message.toLowerCase();
        return /\b(summarize|summary|summarise|recap|tldr|tl;dr|what did we talk about|chat summary|conversation summary|sum up)\b/i.test(msg);
    }

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

    async getDailyDigest() {
        return await summarizer.getDailyDigest();
    }
}

module.exports = new BrainRouter();
