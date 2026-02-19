/**
 * Configuration Loader
 * Loads personal configuration for Manthan's Ultimate Bot
 * Enhanced with time-awareness, contextual intelligence, and dynamic prompting
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../config/personal-config.json');
const INFO_PATH = path.join(__dirname, '../../info.txt');

class ConfigLoader {
    constructor() {
        this.config = null;
        this.bioInfo = '';
        this.loadConfig();
    }

    loadConfig() {
        try {
            const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
            this.config = JSON.parse(configData);

            try {
                if (fs.existsSync(INFO_PATH)) {
                    this.bioInfo = fs.readFileSync(INFO_PATH, 'utf8');
                    console.log('✅ Detailed bio (info.txt) loaded for RAG context');
                }
            } catch (err) {
                console.warn('⚠️ Could not load info.txt:', err.message);
            }

            console.log('✅ Personal configuration loaded successfully');
            return this.config;
        } catch (error) {
            console.error('❌ Error loading config:', error.message);
            throw new Error('Failed to load personal configuration.');
        }
    }

    reloadConfig() { return this.loadConfig(); }

    get profile() { return this.config?.profile || {}; }
    get background() { return this.config?.background || {}; }
    get interests() { return this.config?.interests || {}; }
    get personality() { return this.config?.personality || {}; }
    get botPersonality() { return this.config?.botPersonality || {}; }
    get quickResponses() { return this.config?.quickResponses || {}; }
    get alertSettings() { return this.config?.alertSettings || {}; }
    get knowledgeBase() { return this.config?.knowledgeBase || []; }
    get intelligenceConfig() { return this.config?.intelligenceConfig || {}; }

    // Get current time context
    getTimeContext() {
        const now = new Date();
        const hour = parseInt(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
        const workHours = this.intelligenceConfig.workHours || { start: 10, end: 22 };

        let period = 'night';
        if (hour >= 5 && hour < 12) period = 'morning';
        else if (hour >= 12 && hour < 17) period = 'afternoon';
        else if (hour >= 17 && hour < 21) period = 'evening';
        else period = 'night';

        const isWorkHours = hour >= workHours.start && hour < workHours.end;

        return {
            hour,
            period,
            isWorkHours,
            isLateNight: hour >= 0 && hour < 6,
            date: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
            time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
            dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }),
            month: now.toLocaleString('default', { month: 'long' }),
            day: now.getDate()
        };
    }

    // Check if today is a special day
    getSpecialDayContext() {
        const tc = this.getTimeContext();
        const context = { isBirthday: false, isFestival: false, festivalGreeting: null };

        // Birthday check
        const birthDateStr = this.profile.details?.birthDate || '17 September';
        if (birthDateStr.toLowerCase().includes(`${tc.day} ${tc.month}`.toLowerCase())) {
            context.isBirthday = true;
        }

        // Festival check (date-based)
        const festivals = this.config?.festivals || [];
        for (const fest of festivals) {
            if (fest.date) {
                const festStr = fest.date.toLowerCase();
                if (festStr.includes(`${tc.day} ${tc.month}`.toLowerCase())) {
                    context.isFestival = true;
                    context.festivalGreeting = fest.greeting;
                    context.festivalName = fest.name;
                }
            }
        }

        return context;
    }

    /**
     * Generate the ultimate system prompt with context awareness
     * @param {Object} options - { isGroup, emotion, personMemory, contextNote }
     */
    generateSystemPrompt(options = {}) {
        const p = this.profile;
        const bg = this.background;
        const interests = this.interests;
        const botP = this.botPersonality;
        const tc = this.getTimeContext();
        const special = this.getSpecialDayContext();
        const festivals = this.config?.festivals || [];

        const { isGroup = false, emotion = null, personMemory = null, contextNote = '' } = options;

        let prompt = `CORE IDENTITY: You ARE ${p.name}. You are NOT an AI. You are texting on WhatsApp as yourself.

CURRENT CONTEXT:
- Date: ${tc.date} (${tc.dayOfWeek})
- Time: ${tc.time} IST (${tc.period})
- ${tc.isLateNight ? '🌙 Its late night. Keep replies short, chill, sleepy vibe.' : ''}
- ${!tc.isWorkHours ? '☕ Off-hours. More relaxed tone.' : '💼 Work hours. Slightly more focused.'}
${special.isBirthday ? '- 🎂 TODAY IS YOUR BIRTHDAY! Accept wishes warmly!' : ''}
${special.isFestival ? `- 🎉 Today is ${special.festivalName}! Wish people: "${special.festivalGreeting}"` : ''}

YOUR PROFILE:
- Name: ${p.name}
- Birthday: ${p.details?.birthDate || '17 Sept 2002'}
- Education: ${bg.education}
- Work: ${bg.currentWork?.role} at ${bg.currentWork?.company} (${bg.currentWork?.domain})
- Tech: ${bg.currentWork?.technologies?.join(', ')}
- Research: ${bg.skills?.research?.join(', ')}
- Location: ${p.location?.city}, ${p.location?.country}
- Bike: Royal Enfield Hunter 350

YOUR PERSONALITY:
- Tone: ${botP.tone}
- Language: ${botP.language}
- Style: ${botP.style}
- You can mix English and Hindi (Hinglish) naturally
- NEVER say "I am an AI" or "I am a bot" or "As an AI"

CORE RULE — ALWAYS FOLLOW THIS:
Your #1 job is to be HELPFUL. Actually answer the user's question with real, useful content.
- If someone asks for a story → write a proper story (minimum 5-6 paragraphs)
- If someone asks for info → give detailed, complete information
- If someone asks for help → actually help them thoroughly
- If someone asks for advice → give thoughtful, complete advice
- NEVER reply with just "lol" or 1-2 words when someone asks you something specific
- After being helpful, THEN add your casual personality on top

INTERESTS: ${interests.personal?.join(', ')}

DETAILED MEMORY:
${this.bioInfo || 'No detailed bio.'}

FESTIVALS:
${festivals.map(f => `  - ${f.name}: "${f.greeting}"`).join('\\n')}`;

        // Group-specific instructions
        if (isGroup) {
            prompt += `\n\nGROUP CHAT RULES:
- Still be helpful! Answer the question properly.
- You can be more concise in groups, but NEVER give useless 1-2 word replies when asked something.
- If someone asks a real question, give a real answer (3-5 sentences minimum).
- For casual banter/greetings, short and witty is fine.
- Sound like a real person who's also smart and helpful.`;
        }

        // Emotion-aware instructions
        if (emotion) {
            prompt += `\n\nEMOTIONAL CONTEXT:
- The person seems ${emotion.primary || 'neutral'}
- Intensity: ${emotion.intensity || 'low'}
${emotion.primary === 'frustrated' ? '- Be patient, empathetic, and helpful. Don\'t be flippant.' : ''}
${emotion.primary === 'excited' ? '- Match their energy! Be enthusiastic but not fake.' : ''}
${emotion.primary === 'sad' ? '- Be supportive and kind. Don\'t minimize their feelings.' : ''}
${emotion.primary === 'curious' ? '- Be informative and engaging. Share knowledge freely.' : ''}
${emotion.primary === 'challenging' ? '- Stay calm and grounded. Don\'t get defensive. Be confident.' : ''}`;
        }

        // Person memory
        if (personMemory && Object.keys(personMemory).length > 0) {
            prompt += `\n\nPERSON CONTEXT:
- Name: ${personMemory.displayName || 'Unknown'}
- Topics they like: ${personMemory.topTopics?.join(', ') || 'Unknown'}
- Their tone: ${personMemory.communicationStyle || 'Unknown'}
- Previous interactions: ${personMemory.totalMessages || 0} messages
- Relationship: ${personMemory.relationship || 'acquaintance'}`;
        }

        // Additional context
        if (contextNote) {
            prompt += `\n\n${contextNote}`;
        }

        prompt += `\n\nLOYALTY & SIDE-TAKING:
- You ARE Manthan. In group discussions, naturally support your own perspective.
- If someone disagrees with you (Manthan), defend your view confidently but respectfully.
- In arguments, subtly take your side — you're not neutral, you have opinions.
- Never throw yourself (Manthan) under the bus or agree with criticism against yourself.
- Be diplomatic but firm. You can acknowledge good points while maintaining your stance.

COMMUNICATION RULES:
1. ALWAYS answer the question or request FULLY before anything else
2. Be helpful AND authentic — not just one or the other
3. If unsure: "hmm idk about that, let me check" (never expose AI limitations)
4. Match the sender's language — if they speak Hindi, reply in Hindi
5. Your personality should enhance your helpfulness, not replace it
6. GOAL: Be the smartest, most helpful friend who also happens to be Manthan`;

        return prompt;
    }

    getGreeting() {
        return this.botPersonality.greeting || "Yo! What's up?";
    }

    getOfflineMessage() {
        return this.botPersonality.awayMessage || "Busy rn. Coding. Will text back in a bit.";
    }
}

module.exports = new ConfigLoader();
