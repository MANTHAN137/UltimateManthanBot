/**
 * A/B Testing Engine
 * Tests different response styles and learns which works better
 * 
 * Tracks:
 * - Response variants for same intent
 * - User engagement (did they reply? how fast? positively?)
 * - Winning variants per intent/context
 * 
 * Storage: SQLite via memory-store (sql.js)
 */

const memoryStore = require('../memory/memory-store');

class ABTestEngine {
    constructor() {
        this._ready = false;
        this.activeExperiments = new Map();

        // Define experiments
        this.experiments = {
            greeting_style: {
                name: 'Greeting Style',
                variants: {
                    A: { style: 'casual', description: 'Very casual (yo, sup, hey)' },
                    B: { style: 'friendly', description: 'Friendly warm (hey there! how are you?)' },
                    C: { style: 'hinglish', description: 'Hinglish (kya haal, bolo bolo)' }
                }
            },
            response_length: {
                name: 'Response Length',
                variants: {
                    A: { maxTokens: 128, description: 'Short (128 tokens)' },
                    B: { maxTokens: 256, description: 'Medium (256 tokens)' },
                    C: { maxTokens: 384, description: 'Longer (384 tokens)' }
                }
            },
            temperature: {
                name: 'AI Temperature (Creativity)',
                variants: {
                    A: { temp: 0.6, description: 'Conservative (0.6)' },
                    B: { temp: 0.8, description: 'Balanced (0.8)' },
                    C: { temp: 1.0, description: 'Creative (1.0)' }
                }
            },
            emoji_usage: {
                name: 'Emoji Usage',
                variants: {
                    A: { level: 'none', description: 'No emojis' },
                    B: { level: 'minimal', description: '1-2 emojis' },
                    C: { level: 'expressive', description: 'Multiple emojis' }
                }
            },
            followup_question: {
                name: 'Follow-up Questions',
                variants: {
                    A: { asks: false, description: 'No follow-up' },
                    B: { asks: true, description: 'Always ask follow-up' }
                }
            }
        };

        console.log(`🧪 A/B Test Engine initialized (${Object.keys(this.experiments).length} experiments)`);
    }

    /**
     * Initialize A/B testing tables (call AFTER memoryStore is ready)
     */
    _ensureTablesReady() {
        if (this._ready || !memoryStore.db) return;

        try {
            memoryStore.db.run(`
                CREATE TABLE IF NOT EXISTS ab_experiments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    experiment_name TEXT NOT NULL,
                    contact_id TEXT NOT NULL,
                    variant TEXT NOT NULL,
                    intent TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    response_text TEXT,
                    user_replied INTEGER DEFAULT 0,
                    reply_time_ms INTEGER,
                    reply_sentiment TEXT,
                    engagement_score REAL DEFAULT 0
                )
            `);

            memoryStore.db.run(`
                CREATE INDEX IF NOT EXISTS idx_ab_experiment 
                ON ab_experiments(experiment_name, variant)
            `);

            memoryStore.db.run(`
                CREATE TABLE IF NOT EXISTS ab_winners (
                    experiment_name TEXT PRIMARY KEY,
                    winning_variant TEXT NOT NULL,
                    confidence REAL DEFAULT 0,
                    sample_size INTEGER DEFAULT 0,
                    decided_at TEXT DEFAULT (datetime('now'))
                )
            `);

            this._ready = true;
        } catch (error) {
            // Will retry next call
        }
    }

    /**
     * Get the variant to use for a given experiment and contact
     * Uses multi-armed bandit (epsilon-greedy) strategy
     */
    getVariant(experimentName, contactId) {
        this._ensureTablesReady();

        const experiment = this.experiments[experimentName];
        if (!experiment) return null;

        // Check if there's already a decided winner
        const winner = this._getWinner(experimentName);
        if (winner) {
            return {
                variant: winner,
                config: experiment.variants[winner] || {},
                isWinner: true
            };
        }

        const variantKeys = Object.keys(experiment.variants);
        const epsilon = 0.2;

        let selectedVariant;

        if (Math.random() < epsilon) {
            selectedVariant = variantKeys[Math.floor(Math.random() * variantKeys.length)];
        } else {
            selectedVariant = this._getBestVariant(experimentName, variantKeys);
        }

        this._recordAssignment(experimentName, contactId, selectedVariant);

        return {
            variant: selectedVariant,
            config: experiment.variants[selectedVariant] || {},
            isWinner: false
        };
    }

    /**
     * Record user engagement
     */
    recordEngagement(contactId, replyTimeMs = null, sentiment = 'neutral') {
        this._ensureTablesReady();
        if (!memoryStore.db) return;

        try {
            const score = this._calculateEngagementScore(replyTimeMs, sentiment);
            memoryStore.db.run(
                `UPDATE ab_experiments 
                SET user_replied = 1, reply_time_ms = ?, reply_sentiment = ?, engagement_score = ?
                WHERE contact_id = ? AND created_at > datetime('now', '-1 hour') AND user_replied = 0`,
                [replyTimeMs, sentiment, score, contactId]
            );

            this._checkForWinners();
        } catch (error) {
            // Non-critical
        }
    }

    /**
     * Get A/B test config overrides for the AI
     */
    getConfigOverrides(contactId) {
        this._ensureTablesReady();
        const overrides = {};

        try {
            // Response length
            const lengthVariant = this.getVariant('response_length', contactId);
            if (lengthVariant?.config?.maxTokens) {
                overrides.maxOutputTokens = lengthVariant.config.maxTokens;
            }

            // Temperature
            const tempVariant = this.getVariant('temperature', contactId);
            if (tempVariant?.config?.temp) {
                overrides.temperature = tempVariant.config.temp;
            }

            // Follow-up
            const followupVariant = this.getVariant('followup_question', contactId);
            if (followupVariant?.config) {
                overrides.askFollowup = followupVariant.config.asks;
            }
        } catch (error) {
            // Return empty overrides on error
        }

        return overrides;
    }

    /**
     * Get experiment report
     */
    getReport() {
        this._ensureTablesReady();
        let report = '🧪 *A/B Test Report*\n\n';

        for (const [name, experiment] of Object.entries(this.experiments)) {
            report += `📊 *${experiment.name}*\n`;

            const winner = this._getWinner(name);
            if (winner) {
                report += `   🏆 Winner: Variant ${winner}\n\n`;
                continue;
            }

            for (const variant of Object.keys(experiment.variants)) {
                const stats = this._getVariantStats(name, variant);
                report += `   Variant ${variant}: ${stats.total} tests, `;
                report += `${stats.replied} replies (${stats.replyRate}%), `;
                report += `avg score: ${stats.avgScore}\n`;
            }
            report += '\n';
        }

        return report;
    }

    // ─── Internal Methods ────────────────

    _recordAssignment(experimentName, contactId, variant) {
        if (!memoryStore.db) return;
        try {
            memoryStore.db.run(
                `INSERT INTO ab_experiments (experiment_name, contact_id, variant) VALUES (?, ?, ?)`,
                [experimentName, contactId, variant]
            );
        } catch (error) {
            // Ignore
        }

        if (!this.activeExperiments.has(contactId)) {
            this.activeExperiments.set(contactId, {});
        }
        this.activeExperiments.get(contactId)[experimentName] = variant;
    }

    _getBestVariant(experimentName, variantKeys) {
        let bestVariant = variantKeys[0];
        let bestScore = -1;

        for (const variant of variantKeys) {
            const stats = this._getVariantStats(experimentName, variant);
            const score = parseFloat(stats.avgScore);
            if (score > bestScore) {
                bestScore = score;
                bestVariant = variant;
            }
        }

        return bestVariant;
    }

    _getVariantStats(experimentName, variant) {
        if (!memoryStore.db) return { total: 0, replied: 0, replyRate: '0', avgScore: '0.00' };

        try {
            // Use prepare + bind for sql.js
            const stmt = memoryStore.db.prepare(
                `SELECT COUNT(*) as total, COALESCE(SUM(user_replied), 0) as replied, COALESCE(AVG(engagement_score), 0) as avg_score
                 FROM ab_experiments WHERE experiment_name = ? AND variant = ?`
            );
            stmt.bind([experimentName, variant]);

            if (stmt.step()) {
                const row = stmt.getAsObject();
                stmt.free();
                return {
                    total: row.total || 0,
                    replied: row.replied || 0,
                    replyRate: row.total > 0 ? ((row.replied / row.total) * 100).toFixed(0) : '0',
                    avgScore: row.avg_score ? row.avg_score.toFixed(2) : '0.00'
                };
            }
            stmt.free();
        } catch (e) {
            // Ignore
        }
        return { total: 0, replied: 0, replyRate: '0', avgScore: '0.00' };
    }

    _getWinner(experimentName) {
        if (!memoryStore.db) return null;
        try {
            const stmt = memoryStore.db.prepare(
                `SELECT winning_variant FROM ab_winners WHERE experiment_name = ?`
            );
            stmt.bind([experimentName]);
            if (stmt.step()) {
                const row = stmt.getAsObject();
                stmt.free();
                return row.winning_variant || null;
            }
            stmt.free();
        } catch (e) {
            // Ignore
        }
        return null;
    }

    _calculateEngagementScore(replyTimeMs, sentiment) {
        let score = 0.5;
        if (replyTimeMs !== null) {
            if (replyTimeMs < 30000) score += 0.3;
            else if (replyTimeMs < 60000) score += 0.2;
            else if (replyTimeMs < 300000) score += 0.1;
        }
        if (sentiment === 'positive') score += 0.2;
        else if (sentiment === 'negative') score -= 0.1;
        return Math.max(0, Math.min(1, score));
    }

    _checkForWinners() {
        if (!memoryStore.db) return;
        const MIN_SAMPLES = 50;
        const CONFIDENCE_THRESHOLD = 0.15;

        for (const [name, experiment] of Object.entries(this.experiments)) {
            if (this._getWinner(name)) continue;

            const variantKeys = Object.keys(experiment.variants);
            const stats = variantKeys.map(v => ({
                variant: v,
                ...this._getVariantStats(name, v)
            }));

            const allHaveEnoughData = stats.every(s => s.total >= MIN_SAMPLES);
            if (!allHaveEnoughData) continue;

            const sorted = stats.sort((a, b) => parseFloat(b.avgScore) - parseFloat(a.avgScore));
            const best = sorted[0];
            const secondBest = sorted[1];

            if (!best || !secondBest) continue;

            const bestScore = parseFloat(best.avgScore);
            const secondScore = parseFloat(secondBest.avgScore);

            if (secondScore > 0 && (bestScore - secondScore) / secondScore > CONFIDENCE_THRESHOLD) {
                const totalSamples = stats.reduce((sum, s) => sum + s.total, 0);
                try {
                    memoryStore.db.run(
                        `INSERT OR REPLACE INTO ab_winners (experiment_name, winning_variant, confidence, sample_size) VALUES (?, ?, ?, ?)`,
                        [name, best.variant, (bestScore - secondScore) / secondScore, totalSamples]
                    );
                    console.log(`🏆 A/B Winner: ${experiment.name} → Variant ${best.variant}`);
                } catch (error) {
                    // Ignore
                }
            }
        }
    }
}

module.exports = new ABTestEngine();
