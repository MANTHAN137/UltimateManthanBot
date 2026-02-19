/**
 * Joke Brain
 * Fetches random jokes from free APIs
 * Sources: JokeAPI, icanhazdadjoke
 */

const formatter = require('../engines/formatter');

class JokeBrain {
    constructor() {
        this.JOKE_API = 'https://v2.jokeapi.dev/joke';
        this.DAD_JOKE_API = 'https://icanhazdadjoke.com';
        console.log('😂 Joke Brain initialized');
    }

    /**
     * Process a joke request
     */
    async process(query, isGroup = false) {
        const category = this._detectCategory(query);

        try {
            // Try JokeAPI first
            let joke = await this._fetchJokeAPI(category);

            // Fallback to dad jokes
            if (!joke) {
                joke = await this._fetchDadJoke();
            }

            if (!joke) {
                return {
                    response: "my joke engine is broken rn 😅 but here's one:\n\nwhy do programmers prefer dark mode?\n\n_because light attracts bugs_ 🐛",
                    source: 'joke-brain/hardcoded',
                    isQuickResponse: true
                };
            }

            return {
                response: formatter.formatJoke(joke),
                source: 'joke-brain',
                isQuickResponse: true
            };

        } catch (error) {
            console.error(`   ❌ Joke Brain error: ${error.message}`);
            return {
                response: "joke loading failed... the real joke is my internet rn 😂",
                source: 'joke-brain/error',
                isQuickResponse: true
            };
        }
    }

    /**
     * Fetch from JokeAPI
     */
    async _fetchJokeAPI(category = 'Any') {
        try {
            const url = `${this.JOKE_API}/${category}?blacklistFlags=racist,sexist&type=single,twopart`;

            const response = await fetch(url, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(8000)
            });

            const data = await response.json();

            if (data.error) return null;

            if (data.type === 'twopart') {
                return { type: 'twopart', setup: data.setup, delivery: data.delivery };
            } else {
                return { type: 'single', joke: data.joke };
            }
        } catch (error) {
            console.error(`   ⚠️ JokeAPI failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Fetch from icanhazdadjoke
     */
    async _fetchDadJoke() {
        try {
            const response = await fetch(this.DAD_JOKE_API, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(8000)
            });

            const data = await response.json();

            if (data.joke) {
                return { type: 'single', joke: data.joke };
            }

            return null;
        } catch (error) {
            console.error(`   ⚠️ Dad Joke API failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Check if message is a joke request
     */
    isJokeRequest(message) {
        const msg = message.toLowerCase();
        return /\b(joke|jokes|funny|make me laugh|hasa|hasao|mazak|mazaak|tell me something funny|dad joke|pun|puns)\b/i.test(msg);
    }

    /**
     * Detect joke category from message
     */
    _detectCategory(message) {
        const msg = message.toLowerCase();
        if (/programming|coder|developer|tech|code/i.test(msg)) return 'Programming';
        if (/dark|morbid/i.test(msg)) return 'Dark';
        if (/pun/i.test(msg)) return 'Pun';
        if (/christmas|holiday/i.test(msg)) return 'Christmas';
        if (/spooky|scary/i.test(msg)) return 'Spooky';
        return 'Any';
    }
}

module.exports = new JokeBrain();
