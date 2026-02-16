/**
 * Analytics Engine — Collects and serves bot analytics data
 * Provides data for the web dashboard
 */

const memoryStore = require('../memory/memory-store');

class AnalyticsEngine {
    constructor() {
        this.hourlyMessages = new Array(24).fill(0);
        this.dailyMessages = [];
        this.topContacts = new Map();
        this.intentCounts = {};
        this.brainUsage = {};
        this.responseTimes = [];
        this.startTime = Date.now();
        this.totalProcessed = 0;
        this._currentDay = new Date().toDateString();

        console.log('📈 Analytics Engine initialized');
    }

    /**
     * Record a processed message
     */
    record(data = {}) {
        const { contactId, intent, brain, responseTime, isGroup } = data;
        const hour = new Date().getHours();
        const today = new Date().toDateString();

        // Reset hourly if new day
        if (today !== this._currentDay) {
            this.dailyMessages.push({ date: this._currentDay, count: this.hourlyMessages.reduce((a, b) => a + b, 0) });
            if (this.dailyMessages.length > 30) this.dailyMessages.shift();
            this.hourlyMessages = new Array(24).fill(0);
            this._currentDay = today;
        }

        this.hourlyMessages[hour]++;
        this.totalProcessed++;

        // Track contacts
        if (contactId) {
            const count = this.topContacts.get(contactId) || 0;
            this.topContacts.set(contactId, count + 1);
        }

        // Track intents
        if (intent) {
            this.intentCounts[intent] = (this.intentCounts[intent] || 0) + 1;
        }

        // Track brain usage
        if (brain) {
            this.brainUsage[brain] = (this.brainUsage[brain] || 0) + 1;
        }

        // Track response times
        if (responseTime) {
            this.responseTimes.push(responseTime);
            if (this.responseTimes.length > 1000) this.responseTimes.shift();
        }
    }

    /**
     * Get analytics data for dashboard
     */
    getData() {
        const stats = memoryStore.getStats();
        const avgResponseTime = this.responseTimes.length > 0
            ? Math.round(this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length)
            : 0;

        // Top 10 contacts
        const topContactsList = [...this.topContacts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([id, count]) => ({ id: id.replace('@s.whatsapp.net', '').replace('@g.us', ' (group)'), count }));

        // Top intents
        const topIntents = Object.entries(this.intentCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([intent, count]) => ({ intent, count }));

        // Brain usage
        const brainStats = Object.entries(this.brainUsage)
            .sort((a, b) => b[1] - a[1])
            .map(([brain, count]) => ({ brain, count }));

        return {
            uptime: Math.round((Date.now() - this.startTime) / 1000),
            totalProcessed: this.totalProcessed,
            totalPersons: stats.totalPersons,
            totalMessages: stats.totalMessages,
            avgResponseTime,
            hourlyMessages: this.hourlyMessages,
            dailyMessages: this.dailyMessages,
            topContacts: topContactsList,
            topIntents,
            brainUsage: brainStats,
            currentHour: new Date().getHours(),
            mode: 'online'
        };
    }
}

module.exports = new AnalyticsEngine();
