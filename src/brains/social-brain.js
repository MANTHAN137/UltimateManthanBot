/**
 * Social Brain
 * Handles quick social interactions: greetings, thanks, farewells,
 * birthday wishes, festival greetings, spam detection, group etiquette
 */

const config = require('../utils/config-loader');

class SocialBrain {
    constructor() {
        this.THIN_SEP = '─────────────────────';
        this.greetingVariants = [
            "yo yarr! what's up? 🤙",
            "hey yarr! kya scene hai?",
            "heyy yarr, what's going on?",
            "hey there yarr! 👋",
            "ayyy yarr, what's up!",
            "sup yarr! how's it going?",
            "heyyy yarr, bolo bolo"
        ];

        this.farewellVariants = [
            "catch you later yarr! ✌️",
            "bye yarr! tc 🙏",
            "cya yarr! take care",
            "aight, bye yarr! 👋",
            "peace out yarr ✌️",
            "later yarr! 🫡"
        ];

        this.thanksVariants = [
            "no worries yarr! 🤙",
            "anytime yarr! 😊",
            "haha glad I could help yarr",
            "welcome welcome yarr 🙏",
            "np np yarr!",
            "all good yarr! 👍"
        ];

        console.log('🤝 Social Brain initialized');
    }

    /**
     * Process social interactions
     */
    process(message, intent, emotion, isGroup = false, isHelpRequest = false) {
        const msg = message.toLowerCase().trim();

        // ─── Bot Help / Usage Guide ───────
        if (isHelpRequest) {
            const helpMsg = `🤖 *Hey yarr! Here's what I can do:*\n${this.THIN_SEP}\n\n` +
                `💬 *Chat* — Just text me anything, I'll reply like a real person\n\n` +
                `🔍 *Search* — Say "search <topic>" or "google <topic>"\n\n` +
                `📹 *YouTube* — Say "youtube <topic>" or "yt <topic>" to find videos\n\n` +
                `🌐 *Translate* — Say "translate <text> to <language>"\n\n` +
                `📝 *Todo* — Say "add todo <task>" or "show my todos"\n\n` +
                `⏰ *Reminder* — Say "remind me to <task> in <time>"\n\n` +
                `📋 *Summarize* — Forward a long message and say "summarize this"\n\n` +
                `👁️ *Image Analysis* — Send an image with @bot to analyze it\n\n` +
                `🔗 *Link Preview* — Send any link, I'll give you a quick summary\n\n` +
                `❓ *About Me* — Ask "who is Manthan" or "what do you do"\n\n` +
                `${this.THIN_SEP}\n💡 _In groups, tag me with @bot or reply to my message!_`;
            return {
                response: helpMsg,
                source: 'social-brain/help',
                isQuickResponse: false
            };
        }


        // ─── Spam detection ────────────
        if (intent.primary === 'spam') {
            return isGroup ? null : { // Ignore spam in groups
                response: this._getRandomFrom(["nah I'm good yarr 😂", "lol pass", "not interested yarr", "sorry yarr, not clicking any links 😅"]),
                source: 'social-brain/spam',
                isQuickResponse: true
            };
        }

        // ─── Birthday wishes ──────────
        if (intent.primary === 'birthday') {
            return {
                response: this._getRandomFrom([
                    "ayy thanks yarr! 🎂 means a lot!",
                    "thanks yarr! 🎉 appreciate it!",
                    "haha thanks a lot yarr! 🥳",
                    "thank youu yarr! 🎂✨"
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
                    "got it yarr! I'll check and get back when I'm free 📱",
                    "noted yarr! will reply properly soon 🙏",
                    "acha yarr, let me get back to you on this"
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
