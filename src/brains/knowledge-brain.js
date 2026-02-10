/**
 * Knowledge Brain
 * Handles factual questions about Manthan using the knowledge base
 * Fast, offline-capable, no API needed
 * Also uses NLP (node-nlp) for trained intent matching
 */

const { NlpManager } = require('node-nlp');
const config = require('../utils/config-loader');

class KnowledgeBrain {
    constructor() {
        this.manager = new NlpManager({ languages: ['en'], forceNER: true, nlu: { log: false } });
        this.isTrained = false;
        this.trainModel().catch(err => console.error('❌ NLP Training Failed:', err));
    }

    async trainModel() {
        console.log('📚 Knowledge Brain: Training NLP...');

        const p = config.profile;
        const bg = config.background;
        const botP = config.botPersonality;

        // ─── Greetings ─────────────────
        const greetings = ['hello', 'hi', 'hey', 'yo', 'sup', 'namaste', 'kya haal'];
        greetings.forEach(g => this.manager.addDocument('en', g, 'greetings.hello'));
        this.manager.addAnswer('en', 'greetings.hello', botP.greeting || "Yo! What's up?");

        // ─── Farewell ──────────────────
        const farewells = ['bye', 'goodbye', 'see you', 'cya', 'goodnight', 'tata'];
        farewells.forEach(g => this.manager.addDocument('en', g, 'greetings.bye'));
        this.manager.addAnswer('en', 'greetings.bye', "Catch you later! 👋");

        // ─── About ─────────────────────
        ['who are you', 'tell me about manthan', 'intro', 'introduction', 'about yourself', 'apna intro do'].forEach(
            d => this.manager.addDocument('en', d, 'agent.about')
        );
        this.manager.addAnswer('en', 'agent.about',
            `I'm ${p.name}, software engineer & researcher from ${p.location?.city}. BTech from VJTI, currently working on big data at a global bank. Also into AI, chess, bike rides, and music. That's me in a nutshell.`
        );

        // ─── Work ──────────────────────
        ['where do you work', 'what is your job', 'which company', 'profession', 'kya karte ho'].forEach(
            d => this.manager.addDocument('en', d, 'agent.work')
        );
        this.manager.addAnswer('en', 'agent.work',
            `I work as a ${bg.currentWork?.role} in ${bg.currentWork?.domain} at a global bank. Big data systems, data quality, anomaly detection - that kind of stuff.`
        );

        // ─── Tech Stack ────────────────
        ['tech stack', 'skills', 'what languages do you know', 'coding languages', 'technologies'].forEach(
            d => this.manager.addDocument('en', d, 'agent.tech')
        );
        this.manager.addAnswer('en', 'agent.tech',
            `At work: ${bg.currentWork?.technologies?.slice(0, 5).join(', ')}. Side projects: ${bg.skills?.technical?.join(', ')}. Research: ${bg.skills?.research?.join(', ')}.`
        );

        // ─── Contact ───────────────────
        ['contact', 'email', 'phone number', 'instagram', 'social media', 'how to reach you'].forEach(
            d => this.manager.addDocument('en', d, 'agent.contact')
        );
        this.manager.addAnswer('en', 'agent.contact',
            `Hit me up right here on WhatsApp. Or Insta: ${p.contact?.instagram} | YouTube: ${p.contact?.youtube}`
        );

        // ─── Location ──────────────────
        ['where do you live', 'location', 'city', 'kahan rehte ho'].forEach(
            d => this.manager.addDocument('en', d, 'agent.location')
        );
        this.manager.addAnswer('en', 'agent.location', `Based in ${p.location?.city}, ${p.location?.country}`);

        // ─── Education ─────────────────
        ['college', 'education', 'degree', 'university', 'vjti', 'kahan padhe'].forEach(
            d => this.manager.addDocument('en', d, 'agent.education')
        );
        this.manager.addAnswer('en', 'agent.education', `${bg.education}`);

        // ─── Birthday ──────────────────
        ['birthday', 'when were you born', 'age', 'born', 'janam din'].forEach(
            d => this.manager.addDocument('en', d, 'agent.birthday')
        );
        this.manager.addAnswer('en', 'agent.birthday', `Born on ${p.details?.birthDate}. Virgo gang 😎`);

        // ─── Knowledge Base entries ────
        const kb = config.knowledgeBase;
        if (kb && Array.isArray(kb)) {
            kb.forEach((item, i) => {
                const intentName = `kb.${i}`;
                item.patterns.forEach(pattern => this.manager.addDocument('en', pattern, intentName));
                this.manager.addAnswer('en', intentName, item.answer);
            });
        }

        // ─── Festivals ─────────────────
        const festivals = config.config?.festivals || [];
        festivals.forEach((fest, i) => {
            const intentName = `festival.${i}`;
            this.manager.addDocument('en', `happy ${fest.name.toLowerCase()}`, intentName);
            this.manager.addDocument('en', fest.name.toLowerCase(), intentName);
            this.manager.addAnswer('en', intentName, fest.greeting);
        });

        // ─── Train & Save ──────────────
        await this.manager.train();
        this.isTrained = true;
        console.log('✅ Knowledge Brain trained successfully');
    }

    /**
     * Process a message through knowledge brain
     * Returns response only if confidence is high enough
     */
    async process(message, intent) {
        // Method 1: Keyword-based KB matching (fast)
        const kbMatch = this._matchKnowledgeBase(message);
        if (kbMatch) {
            return {
                response: kbMatch,
                source: 'knowledge-brain/kb',
                isQuickResponse: true
            };
        }

        // Method 2: NLP classification (trained model)
        if (this.isTrained) {
            try {
                const result = await this.manager.process('en', message);
                const threshold = 0.65; // Slightly lower than before for better coverage

                if (result.intent !== 'None' && result.score > threshold && result.answer) {
                    return {
                        response: result.answer,
                        source: `knowledge-brain/nlp (${(result.score * 100).toFixed(0)}%)`,
                        isQuickResponse: true
                    };
                }
            } catch (error) {
                console.error('   ❌ NLP processing error:', error.message);
            }
        }

        return null; // Nothing matched, let other brains handle it
    }

    /**
     * Fast keyword-based KB matching
     */
    _matchKnowledgeBase(message) {
        const msg = message.toLowerCase();
        const kb = config.knowledgeBase;

        let bestMatch = null;
        let maxScore = 0;

        for (const entry of kb) {
            let score = 0;
            for (const pattern of entry.patterns) {
                if (msg.includes(pattern.toLowerCase())) {
                    score++;
                }
            }

            // Require at least 1 match, prefer more
            if (score > maxScore) {
                maxScore = score;
                bestMatch = entry;
            }
        }

        return bestMatch && maxScore > 0 ? bestMatch.answer : null;
    }
}

module.exports = new KnowledgeBrain();
