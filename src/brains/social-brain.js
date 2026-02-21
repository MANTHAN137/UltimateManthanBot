/**
 * Social Brain
 * Handles quick social interactions: greetings, thanks, farewells,
 * birthday wishes, festival greetings, spam detection, group etiquette
 */

const config = require('../utils/config-loader');

class SocialBrain {
    constructor() {
        this.greetingVariants = [
            "yo! what's up? 🤙",
            "hey! kya scene hai?",
            "heyy, what's going on?",
            "hey there! 👋",
            "ayyy, what's up!",
            "sup! how's it going?",
            "heyyy, bolo bolo"
        ];

        this.farewellVariants = [
            "catch you later! ✌️",
            "bye! tc 🙏",
            "cya! take care",
            "aight, bye! 👋",
            "peace out ✌️",
            "later! 🫡"
        ];

        this.thanksVariants = [
            "no worries! 🤙",
            "anytime! 😊",
            "haha glad I could help",
            "welcome welcome 🙏",
            "np np!",
            "all good! 👍"
        ];

        console.log('🤝 Social Brain initialized');
    }

    /**
     * Process social interactions
     */
    process(message, intent, emotion, isGroup = false) {
        const msg = message.toLowerCase().trim();

        // ─── Spam detection ────────────
        if (intent.primary === 'spam') {
            return isGroup ? null : { // Ignore spam in groups
                response: this._getRandomFrom(["nah I'm good 😂", "lol pass", "not interested bro", "sorry, not clicking any links 😅"]),
                source: 'social-brain/spam',
                isQuickResponse: true
            };
        }

        // ─── Birthday wishes ──────────
        if (intent.primary === 'birthday') {
            return {
                response: this._getRandomFrom([
                    "ayy thanks yaar! 🎂 means a lot!",
                    "thanks bro! 🎉 appreciate it!",
                    "haha thanks a lot! 🥳",
                    "thank youu! 🎂✨"
                ]),
                source: 'social-brain/birthday',
                isQuickResponse: true
            };
        }

        // ─── Festival greetings ───────
        if (intent.primary === 'festival') {
            // Check config for specific festival greeting
            const festivals = config.config?.festivals || [];
            for (const fest of festivals) {
                if (msg.includes(fest.name.toLowerCase())) {
                    return {
                        response: fest.greeting,
                        source: `social-brain/festival-${fest.name}`,
                        isQuickResponse: true
                    };
                }
            }

            return {
                response: this._getRandomFrom([
                    "same to you! ✨ enjoy the day!",
                    "thanks! same to you too! 🎉",
                    "happy celebrations! ✨🙏"
                ]),
                source: 'social-brain/festival',
                isQuickResponse: true
            };
        }

        /* 
         * DISABLED: Let ChatBrain handle these for maximum realism
         * ─── Greeting ─────────────────
         * ─── Farewell ─────────────────
         * ─── Thanks ───────────────────
         */

        // ─── Human Request ────────────
        if (intent.primary === 'human_request') {
            return {
                response: this._getRandomFrom([
                    "got it! I'll check and get back when I'm free 📱",
                    "noted! will reply properly soon 🙏",
                    "acha, let me get back to you on this"
                ]),
                source: 'social-brain/human-request',
                isQuickResponse: true
            };
        }

        return null; // Not a social interaction, pass to next brain
    }

    _getRandomFrom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }
}

module.exports = new SocialBrain();
