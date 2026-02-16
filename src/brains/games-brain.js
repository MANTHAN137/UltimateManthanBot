/**
 * Games Brain — Mini text games for WhatsApp
 * Games: Trivia Quiz, Number Guess, Word Scramble
 */

class GamesBrain {
    constructor() {
        this.sessions = new Map();
        this.trivia = [
            { q: "What planet is known as the Red Planet?", a: "mars", opts: ["Venus", "Mars", "Jupiter", "Saturn"] },
            { q: "Capital of Japan?", a: "tokyo", opts: ["Seoul", "Beijing", "Tokyo", "Osaka"] },
            { q: "Who painted the Mona Lisa?", a: "leonardo", opts: ["Picasso", "Leonardo da Vinci", "Van Gogh", "Michelangelo"] },
            { q: "Largest ocean on Earth?", a: "pacific", opts: ["Atlantic", "Indian", "Pacific", "Arctic"] },
            { q: "Chemical symbol for gold?", a: "au", opts: ["Go", "Gd", "Au", "Ag"] },
            { q: "Most populated country?", a: "india", opts: ["China", "India", "USA", "Indonesia"] },
            { q: "Year Titanic sank?", a: "1912", opts: ["1905", "1912", "1920", "1898"] },
            { q: "Smallest country?", a: "vatican", opts: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"] },
            { q: "Bones in adult human?", a: "206", opts: ["186", "196", "206", "216"] },
            { q: "Fastest land animal?", a: "cheetah", opts: ["Lion", "Cheetah", "Leopard", "Tiger"] },
            { q: "Who created JavaScript?", a: "brendan", opts: ["Guido", "Brendan Eich", "Dennis Ritchie", "James Gosling"] },
            { q: "HTTP stands for?", a: "hypertext", opts: ["HyperText Transfer Protocol", "High Tech Transfer", "HyperText Transmission", "High Transfer Text"] },
            { q: "Currency of Japan?", a: "yen", opts: ["Won", "Yuan", "Yen", "Ringgit"] },
            { q: "India's independence year?", a: "1947", opts: ["1942", "1945", "1947", "1950"] },
            { q: "National animal of India?", a: "tiger", opts: ["Lion", "Tiger", "Elephant", "Peacock"] },
            { q: "Boiling point of water (°C)?", a: "100", opts: ["90", "100", "110", "212"] },
            { q: "Who wrote Romeo & Juliet?", a: "shakespeare", opts: ["Dickens", "Shakespeare", "Twain", "Austen"] },
            { q: "How many continents?", a: "7", opts: ["5", "6", "7", "8"] },
            { q: "Largest desert?", a: "sahara", opts: ["Gobi", "Sahara", "Arabian", "Kalahari"] },
            { q: "CPU stands for?", a: "central", opts: ["Central Processing Unit", "Computer Processing Unit", "Central Program Utility", "Core Processing Unit"] },
        ];
        this.words = ["javascript", "python", "programming", "computer", "algorithm", "database", "internet", "software", "developer", "engineer", "cricket", "football", "elephant", "mountain", "chocolate", "pizza", "biryani", "rainbow", "thunder", "penguin"];
        console.log('🎮 Games Brain initialized');
    }

    isGameRequest(msg) { return /\b(game|play|trivia|quiz|guess|scramble|khelna|khel)\b/i.test(msg); }
    hasActiveGame(id) { return this.sessions.has(id); }

    process(message, contactId) {
        const msg = message.toLowerCase().trim();
        if (this.sessions.has(contactId)) return this._handleInput(msg, contactId);
        if (/\b(trivia|quiz)\b/i.test(msg)) return this._startTrivia(contactId);
        if (/\b(guess|number)\b/i.test(msg)) return this._startNumber(contactId);
        if (/\b(scramble|word)\b/i.test(msg)) return this._startScramble(contactId);
        if (/\b(quit|exit|stop|end)\b/i.test(msg)) return this._end(contactId);
        return { response: `🎮 *Mini Games!*\n\n1️⃣ *Trivia Quiz* → send "trivia"\n2️⃣ *Number Guess* → send "guess the number"\n3️⃣ *Word Scramble* → send "word scramble"\n\n_Send "quit game" to stop_`, source: 'games-brain/menu', isQuickResponse: true };
    }

    _startTrivia(id) {
        const used = [];
        const q = this._randTrivia(used);
        this.sessions.set(id, { game: 'trivia', score: 0, round: 1, max: 5, q, used });
        return { response: `🧠 *Trivia Quiz!* (5 questions)\n\n*Q1:* ${q.q}\n\n${q.opts.map((o, i) => `${'ABCD'[i]}. ${o}`).join('\n')}\n\n_Reply A, B, C, or D_`, source: 'games-brain/trivia', isQuickResponse: true };
    }

    _startNumber(id) {
        this.sessions.set(id, { game: 'number', target: Math.floor(Math.random() * 100) + 1, att: 0, max: 7 });
        return { response: `🔢 *Number Guess!*\n\nI'm thinking 1-100. You have 7 tries.\n_Send your guess!_`, source: 'games-brain/number', isQuickResponse: true };
    }

    _startScramble(id) {
        const w = this.words[Math.floor(Math.random() * this.words.length)];
        const s = this._scramble(w);
        this.sessions.set(id, { game: 'scramble', word: w, scrambled: s, hints: 0, att: 0 });
        return { response: `🔤 *Word Scramble!*\n\nUnscramble: *${s.toUpperCase()}*\n📝 ${w.length} letters\n💡 Send "hint" for a clue`, source: 'games-brain/scramble', isQuickResponse: true };
    }

    _handleInput(msg, id) {
        if (/\b(quit|exit|stop|end)\b/i.test(msg)) return this._end(id);
        const s = this.sessions.get(id);
        if (s.game === 'trivia') return this._trivia(msg, id, s);
        if (s.game === 'number') return this._number(msg, id, s);
        if (s.game === 'scramble') return this._scram(msg, id, s);
        return null;
    }

    _trivia(msg, id, s) {
        const map = { a: 0, b: 1, c: 2, d: 3 };
        const idx = map[msg.charAt(0)];
        if (idx === undefined) return { response: `Reply *A*, *B*, *C*, or *D*`, source: 'games-brain/trivia', isQuickResponse: true };
        const sel = s.q.opts[idx]?.toLowerCase() || '';
        const ok = sel.includes(s.q.a) || s.q.a.includes(sel);
        if (ok) s.score++;
        let r = ok ? `✅ Correct! +1\n` : `❌ Wrong! Answer: *${s.q.opts.find(o => o.toLowerCase().includes(s.q.a)) || s.q.a}*\n`;
        r += `📊 Score: ${s.score}/${s.round}\n`;
        s.round++;
        if (s.round > s.max) { this.sessions.delete(id); const p = Math.round(s.score / s.max * 100); return { response: r + `\n${p >= 80 ? '🏆' : p >= 60 ? '🌟' : '👍'} *Game Over!* ${s.score}/${s.max} (${p}%)`, source: 'games-brain/trivia-end', isQuickResponse: true }; }
        const nq = this._randTrivia(s.used); s.q = nq;
        r += `\n*Q${s.round}:* ${nq.q}\n\n${nq.opts.map((o, i) => `${'ABCD'[i]}. ${o}`).join('\n')}\n\n_Reply A, B, C, or D_`;
        return { response: r, source: 'games-brain/trivia', isQuickResponse: true };
    }

    _number(msg, id, s) {
        const g = parseInt(msg);
        if (isNaN(g) || g < 1 || g > 100) return { response: `🔢 Number 1-100! ${s.max - s.att} left`, source: 'games-brain/number', isQuickResponse: true };
        s.att++;
        if (g === s.target) { this.sessions.delete(id); return { response: `🎉 *CORRECT!* It was *${s.target}*! Got it in ${s.att} tries! ${s.att <= 3 ? '🏆' : s.att <= 5 ? '🌟' : '👍'}`, source: 'games-brain/number-win', isQuickResponse: true }; }
        if (s.att >= s.max) { this.sessions.delete(id); return { response: `💀 *Game Over!* It was *${s.target}*`, source: 'games-brain/number-lose', isQuickResponse: true }; }
        const d = Math.abs(g - s.target); const t = d <= 5 ? '🔥 Very close!' : d <= 15 ? '♨️ Warm!' : d <= 30 ? '🌡️ Warm' : '❄️ Cold';
        return { response: `${g < s.target ? '📈 Higher!' : '📉 Lower!'} ${t}\n⏳ ${s.max - s.att} left`, source: 'games-brain/number', isQuickResponse: true };
    }

    _scram(msg, id, s) {
        if (/\bhint\b/i.test(msg)) { s.hints++; const w = s.word; const h = s.hints === 1 ? `First: *${w[0].toUpperCase()}*` : s.hints === 2 ? `Last: *${w[w.length - 1].toUpperCase()}*` : `*${w[0]}${'_'.repeat(w.length - 2)}${w[w.length - 1]}*`; return { response: `💡 ${h}`, source: 'games-brain/scramble', isQuickResponse: true }; }
        s.att++;
        if (msg === s.word) { this.sessions.delete(id); return { response: `🎉 *CORRECT!* It was *${s.word.toUpperCase()}*! ${s.hints === 0 ? '🏆' : '👍'} (${s.att} tries, ${s.hints} hints)`, source: 'games-brain/scramble-win', isQuickResponse: true }; }
        if (s.att >= 5) { this.sessions.delete(id); return { response: `💀 *Game Over!* It was *${s.word.toUpperCase()}*`, source: 'games-brain/scramble-lose', isQuickResponse: true }; }
        return { response: `❌ Try again!\n🔤 *${s.scrambled.toUpperCase()}*\n⏳ ${5 - s.att} left | 💡 "hint"`, source: 'games-brain/scramble', isQuickResponse: true };
    }

    _end(id) { const s = this.sessions.get(id); this.sessions.delete(id); return { response: s ? `👋 Game ended! Send "game" to play again!` : `No active game. Send "game" to start!`, source: 'games-brain/quit', isQuickResponse: true }; }
    _randTrivia(used) { let i; do { i = Math.floor(Math.random() * this.trivia.length); } while (used.includes(i) && used.length < this.trivia.length); used.push(i); return this.trivia[i]; }
    _scramble(w) { const a = w.split(''); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } const s = a.join(''); return s === w ? this._scramble(w) : s; }
}

module.exports = new GamesBrain();
