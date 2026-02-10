/**
 * Memory Store — Pure JavaScript SQLite (sql.js)
 * Works on Termux/Android/Mobile without native compilation
 * 
 * 4 Bucket Memory Architecture:
 *   1. Person Memory — Who is this person, how do they talk
 *   2. Context Memory — Recent conversation context
 *   3. Style Memory — Manthan's style preferences
 *   4. Safety Memory — What NOT to do/say
 * 
 * IMPORTANT: Call memoryStore.ensureReady() before first use
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/memory.db');

class MemoryStore {
    constructor() {
        this.db = null;
        this._ownerTakeover = new Map();
        this._ready = false;
        this._readyPromise = this._init();
    }

    async _init() {
        const dataDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const SQL = await initSqlJs();

        if (fs.existsSync(DB_PATH)) {
            const fileBuffer = fs.readFileSync(DB_PATH);
            this.db = new SQL.Database(fileBuffer);
        } else {
            this.db = new SQL.Database();
        }

        this._initTables();
        this._saveInterval = setInterval(() => this._saveToDisk(), 30000);
        this._ready = true;
        console.log('🧠 Memory Store initialized (sql.js — pure JS, mobile-friendly)');
    }

    async ensureReady() {
        if (!this._ready) await this._readyPromise;
    }

    _saveToDisk() {
        try {
            if (this.db) {
                const data = this.db.export();
                fs.writeFileSync(DB_PATH, Buffer.from(data));
            }
        } catch (e) {
            console.error('❌ DB save error:', e.message);
        }
    }

    _initTables() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS person_memory (
                contact_id TEXT PRIMARY KEY,
                display_name TEXT,
                phone_number TEXT,
                communication_style TEXT DEFAULT 'unknown',
                relationship TEXT DEFAULT 'acquaintance',
                top_topics TEXT DEFAULT '[]',
                emotion_history TEXT DEFAULT '[]',
                total_messages INTEGER DEFAULT 0,
                first_seen TEXT,
                last_seen TEXT,
                notes TEXT DEFAULT '',
                is_important INTEGER DEFAULT 0
            )
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS conversation_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contact_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                emotion TEXT,
                intent TEXT,
                timestamp TEXT DEFAULT (datetime('now')),
                is_group INTEGER DEFAULT 0
            )
        `);

        this.db.run(`
            CREATE INDEX IF NOT EXISTS idx_conv_contact 
            ON conversation_log(contact_id, timestamp DESC)
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS safety_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_type TEXT NOT NULL,
                rule_text TEXT NOT NULL,
                severity TEXT DEFAULT 'medium',
                created_at TEXT DEFAULT (datetime('now'))
            )
        `);

        const count = this.db.exec('SELECT COUNT(*) FROM safety_rules');
        if ((count[0]?.values[0]?.[0] || 0) === 0) {
            this._insertDefaultSafetyRules();
        }

        this._saveToDisk();
    }

    _insertDefaultSafetyRules() {
        const rules = [
            { type: 'commitment', text: 'Never agree to meetings, payments, or time commitments', severity: 'high' },
            { type: 'privacy', text: 'Never share private data like bank details, passwords, or addresses', severity: 'critical' },
            { type: 'pricing', text: 'Never quote prices or make financial promises', severity: 'high' },
            { type: 'identity', text: 'Never say you are an AI, bot, or automated system', severity: 'critical' },
            { type: 'promises', text: 'Never make promises on behalf of Manthan', severity: 'medium' },
            { type: 'sensitive', text: 'If conversation becomes sensitive, defer politely', severity: 'high' },
            { type: 'personal', text: 'Do not share other people\'s information', severity: 'high' }
        ];

        for (const rule of rules) {
            this.db.run(
                'INSERT INTO safety_rules (rule_type, rule_text, severity) VALUES (?, ?, ?)',
                [rule.type, rule.text, rule.severity]
            );
        }
    }

    // ═══════════════════════════════════════
    // BUCKET 1: Person Memory
    // ═══════════════════════════════════════

    getPersonMemory(contactId) {
        if (!this.db) return null;
        const stmt = this.db.prepare('SELECT * FROM person_memory WHERE contact_id = ?');
        stmt.bind([contactId]);

        if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            row.top_topics = JSON.parse(row.top_topics || '[]');
            row.emotion_history = JSON.parse(row.emotion_history || '[]');
            row.topTopics = row.top_topics;
            row.communicationStyle = row.communication_style;
            row.displayName = row.display_name;
            row.totalMessages = row.total_messages;
            return row;
        }

        stmt.free();
        return null;
    }

    updatePersonMemory(contactId, updates = {}) {
        if (!this.db) return;
        const existing = this.getPersonMemory(contactId);

        if (!existing) {
            this.db.run(
                `INSERT INTO person_memory (contact_id, display_name, phone_number, first_seen, last_seen, total_messages) VALUES (?, ?, ?, datetime('now'), datetime('now'), 1)`,
                [contactId, updates.displayName || '', updates.phoneNumber || '']
            );
        } else {
            const sets = [];
            const params = [];

            if (updates.displayName) { sets.push('display_name = ?'); params.push(updates.displayName); }
            if (updates.communicationStyle) { sets.push('communication_style = ?'); params.push(updates.communicationStyle); }
            if (updates.relationship) { sets.push('relationship = ?'); params.push(updates.relationship); }
            if (updates.topTopics) { sets.push('top_topics = ?'); params.push(JSON.stringify(updates.topTopics)); }
            if (updates.notes) { sets.push('notes = ?'); params.push(updates.notes); }

            sets.push("last_seen = datetime('now')");
            sets.push('total_messages = total_messages + 1');

            params.push(contactId);
            this.db.run(`UPDATE person_memory SET ${sets.join(', ')} WHERE contact_id = ?`, params);
        }
    }

    learnPersonStyle(contactId, message) {
        if (!this.db) return;
        const style = this._detectCommunicationStyle(message);
        const topics = this._extractTopics(message);

        const existing = this.getPersonMemory(contactId);
        if (existing) {
            const allTopics = [...new Set([...(existing.top_topics || []), ...topics])].slice(-5);
            this.db.run(
                `UPDATE person_memory SET communication_style = ?, top_topics = ?, last_seen = datetime('now') WHERE contact_id = ?`,
                [style, JSON.stringify(allTopics), contactId]
            );
        }
    }

    _detectCommunicationStyle(message) {
        const msg = message.toLowerCase();
        if (/bro|yaar|bhai|dude|man/.test(msg)) return 'casual-friendly';
        if (/sir|madam|please|kindly|would you/.test(msg)) return 'formal';
        if (/lol|lmao|haha|😂|🤣/.test(msg)) return 'humorous';
        if (/kya|kaise|kyun|matlab|samjha/.test(msg)) return 'hinglish';
        if (msg.length < 20) return 'brief';
        if (msg.length > 200) return 'detailed';
        return 'neutral';
    }

    _extractTopics(message) {
        const msg = message.toLowerCase();
        const topicMap = {
            'tech': /tech|code|coding|programming|developer|software|api|backend|frontend/,
            'ai': /ai|artificial|machine learning|ml|gpt|gemini|neural|deep learning/,
            'bike': /bike|ride|riding|enfield|hunter|motorcycle|bullet/,
            'chess': /chess|rating|elo|gambit|opening/,
            'finance': /invest|stock|market|money|crypto|trading|finance/,
            'career': /job|work|company|career|salary|promotion|interview/,
            'music': /music|song|singing|guitar|instrument|stream/,
            'personal': /life|love|relationship|feeling|emotion|mental/,
            'youtube': /youtube|video|content|channel|subscriber/,
            'education': /college|university|degree|study|exam|vjti/
        };

        const topics = [];
        for (const [topic, regex] of Object.entries(topicMap)) {
            if (regex.test(msg)) topics.push(topic);
        }
        return topics;
    }

    recordEmotion(contactId, emotion) {
        if (!this.db) return;
        const existing = this.getPersonMemory(contactId);
        if (existing) {
            const history = existing.emotion_history || [];
            history.push({ emotion: emotion.primary, timestamp: new Date().toISOString() });
            const trimmed = history.slice(-10);
            this.db.run(
                `UPDATE person_memory SET emotion_history = ? WHERE contact_id = ?`,
                [JSON.stringify(trimmed), contactId]
            );
        }
    }

    // ═══════════════════════════════════════
    // BUCKET 2: Context Memory (Conversations)
    // ═══════════════════════════════════════

    addConversationMessage(contactId, role, content, options = {}) {
        if (!this.db) return;
        this.db.run(
            `INSERT INTO conversation_log (contact_id, role, content, emotion, intent, is_group) VALUES (?, ?, ?, ?, ?, ?)`,
            [contactId, role, content, options.emotion || null, options.intent || null, options.isGroup ? 1 : 0]
        );
    }

    getRecentHistory(contactId, limit = 10) {
        if (!this.db) return [];
        const stmt = this.db.prepare(
            `SELECT role, content, emotion, intent, timestamp FROM conversation_log WHERE contact_id = ? ORDER BY timestamp DESC LIMIT ?`
        );
        stmt.bind([contactId, limit]);

        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();

        return rows.reverse();
    }

    getFormattedHistory(contactId, limit = 10) {
        const history = this.getRecentHistory(contactId, limit);
        return history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));
    }

    isNewContact(contactId) {
        const person = this.getPersonMemory(contactId);
        return !person || (person.total_messages || 0) <= 1;
    }

    // ═══════════════════════════════════════
    // BUCKET 4: Safety Memory
    // ═══════════════════════════════════════

    getSafetyRules() {
        if (!this.db) return [];
        const result = this.db.exec('SELECT * FROM safety_rules ORDER BY severity DESC');
        if (!result[0]) return [];
        return result[0].values.map(row => ({
            id: row[0], rule_type: row[1], rule_text: row[2], severity: row[3], created_at: row[4]
        }));
    }

    getSafetyPrompt() {
        const rules = this.getSafetyRules();
        if (rules.length === 0) return '';
        return 'SAFETY RULES (MUST FOLLOW):\n' +
            rules.map(r => `- [${r.severity.toUpperCase()}] ${r.rule_text}`).join('\n');
    }

    // ═══════════════════════════════════════
    // Owner Takeover (30 second silence)
    // When Manthan sends or replies, bot goes SILENT for 30s
    // ═══════════════════════════════════════

    setOwnerTakeover(contactId) {
        this._ownerTakeover.set(contactId, { startedAt: Date.now(), lastOwnerMessage: Date.now() });
    }

    updateOwnerActivity(contactId) {
        // Every owner message RESETS the 30s timer
        if (this._ownerTakeover.has(contactId)) {
            this._ownerTakeover.get(contactId).lastOwnerMessage = Date.now();
        } else {
            this.setOwnerTakeover(contactId);
        }
    }

    isOwnerHandling(contactId, timeoutMs = 30000) {
        if (!this._ownerTakeover.has(contactId)) return false;
        const takeover = this._ownerTakeover.get(contactId);
        const elapsed = Date.now() - takeover.lastOwnerMessage;
        if (elapsed > timeoutMs) {
            this._ownerTakeover.delete(contactId);
            return false;
        }
        return true;
    }

    releaseOwnerTakeover(contactId) {
        this._ownerTakeover.delete(contactId);
    }

    getOwnerTakeoverTimeRemaining(contactId, timeoutMs = 30000) {
        if (!this._ownerTakeover.has(contactId)) return 0;
        const takeover = this._ownerTakeover.get(contactId);
        return Math.max(0, timeoutMs - (Date.now() - takeover.lastOwnerMessage));
    }

    // ═══════════════════════════════════════
    // Cleanup & Stats
    // ═══════════════════════════════════════

    cleanup() {
        if (!this.db) return;
        this.db.run(`DELETE FROM conversation_log WHERE timestamp < datetime('now', '-7 days')`);

        for (const [contactId, takeover] of this._ownerTakeover) {
            if (Date.now() - takeover.lastOwnerMessage > 300000) {
                this._ownerTakeover.delete(contactId);
            }
        }

        this._saveToDisk();
    }

    getStats() {
        if (!this.db) return { totalPersons: 0, totalMessages: 0, safetyRules: 0, activeOwnertakeovers: 0 };
        const persons = this.db.exec('SELECT COUNT(*) FROM person_memory');
        const messages = this.db.exec('SELECT COUNT(*) FROM conversation_log');
        const safety = this.db.exec('SELECT COUNT(*) FROM safety_rules');
        return {
            totalPersons: persons[0]?.values[0]?.[0] || 0,
            totalMessages: messages[0]?.values[0]?.[0] || 0,
            safetyRules: safety[0]?.values[0]?.[0] || 0,
            activeOwnertakeovers: this._ownerTakeover.size
        };
    }

    close() {
        this._saveToDisk();
        clearInterval(this._saveInterval);
        if (this.db) this.db.close();
    }
}

module.exports = new MemoryStore();
