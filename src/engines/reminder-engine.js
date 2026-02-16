/**
 * Reminder Engine
 * Set and manage reminders via natural language
 * 
 * Capabilities:
 * - "remind me in 30 min to call mom"
 * - "reminder at 6pm: check email"
 * - Owner: "@bot remind 919XXXXXXXXX in 2 hours: check document"
 * - List active reminders
 * - Cancel reminders
 * 
 * Storage: In-memory (reminders don't survive restarts)
 */

class ReminderEngine {
    constructor() {
        this.reminders = new Map(); // id -> reminder
        this.nextId = 1;
        this.sock = null; // Will be set from bot.js

        // Patterns to detect reminder requests
        this.reminderPatterns = [
            /remind\s+me\s+(in\s+)?(.+?)\s+(to|about|that)\s+(.+)/i,
            /reminder\s+(in\s+)?(.+?)[\s:]+(.+)/i,
            /set\s+(a\s+)?reminder\s+(in\s+)?(.+?)\s+(to|about|for)\s+(.+)/i,
            /yaad\s+dila(na|o)\s+(.+)/i
        ];

        console.log('⏰ Reminder Engine initialized');
    }

    /**
     * Set the WhatsApp socket (called from bot.js)
     */
    setSocket(sock) {
        this.sock = sock;
    }

    /**
     * Check if a message is a reminder request
     */
    isReminderRequest(message) {
        const msg = message.toLowerCase();
        return /\b(remind|reminder|yaad dila|alert me|notify me)\b/i.test(msg);
    }

    /**
     * Process a reminder request
     */
    process(message, contactId) {
        const msg = message.toLowerCase().trim();

        // List reminders
        if (/\b(list|show|active|my)\s*(reminder|reminders)\b/i.test(msg)) {
            return this._listReminders(contactId);
        }

        // Cancel reminder
        const cancelMatch = msg.match(/cancel\s+reminder\s+#?(\d+)/i);
        if (cancelMatch) {
            return this._cancelReminder(parseInt(cancelMatch[1]), contactId);
        }

        // Parse new reminder
        return this._parseAndSet(message, contactId);
    }

    /**
     * Parse natural language reminder and set it
     */
    _parseAndSet(message, contactId) {
        let duration = null;
        let task = null;

        // Pattern: "remind me in X to Y"
        let match = message.match(/remind\s+(?:me\s+)?in\s+(.+?)\s+(?:to|about|that|:)\s+(.+)/i);
        if (match) {
            duration = this._parseDuration(match[1]);
            task = match[2].trim();
        }

        // Pattern: "reminder in X: Y" or "set reminder X: Y"
        if (!duration) {
            match = message.match(/(?:set\s+)?reminder\s+(?:in\s+)?(.+?)[\s:]+(?:to|about|for|:)?\s*(.+)/i);
            if (match) {
                duration = this._parseDuration(match[1]);
                task = match[2].trim();
            }
        }

        // Pattern: "remind me after X Y"
        if (!duration) {
            match = message.match(/remind\s+(?:me\s+)?after\s+(.+?)\s+(?:to|about|that|:)\s+(.+)/i);
            if (match) {
                duration = this._parseDuration(match[1]);
                task = match[2].trim();
            }
        }

        // Hindi pattern
        if (!duration) {
            match = message.match(/yaad\s+dila(?:na|o)\s+(.+?)\s+(?:mein|me|baad)\s+(.+)/i);
            if (match) {
                duration = this._parseDuration(match[1]);
                task = match[2].trim();
            }
        }

        // Simple fallback: "remind me <duration>" (no task specified)
        if (!duration) {
            match = message.match(/remind\s+(?:me\s+)?(?:in\s+)?(\d+\s*(?:min|minute|hour|hr|sec|second|h|m|s)s?)/i);
            if (match) {
                duration = this._parseDuration(match[1]);
                task = 'your reminder!';
            }
        }

        if (!duration || duration < 5000) { // minimum 5 seconds
            return {
                response: "⏰ I couldn't understand the time. Try something like:\n• _remind me in 30 min to call mom_\n• _reminder in 2 hours: check email_\n• _remind me in 1 hour to take a break_",
                source: 'reminder-engine/error',
                isQuickResponse: true
            };
        }

        if (duration > 86400000) { // max 24 hours
            return {
                response: "⏰ Max reminder duration is 24 hours. Set a shorter reminder?",
                source: 'reminder-engine/error',
                isQuickResponse: true
            };
        }

        // Set the reminder
        const id = this.nextId++;
        const triggerTime = Date.now() + duration;

        const timer = setTimeout(() => {
            this._fireReminder(id);
        }, duration);

        this.reminders.set(id, {
            id,
            contactId,
            task: task || 'your reminder!',
            duration,
            triggerTime,
            timer,
            createdAt: Date.now()
        });

        const durationStr = this._formatDuration(duration);
        return {
            response: `⏰ *Reminder set!*\n📝 ${task || 'Reminder'}\n⏳ In ${durationStr}\n🆔 #${id}\n\n_Send "cancel reminder #${id}" to cancel_`,
            source: 'reminder-engine',
            isQuickResponse: true
        };
    }

    /**
     * Fire a reminder — send the message
     */
    async _fireReminder(id) {
        const reminder = this.reminders.get(id);
        if (!reminder) return;

        const msg = `⏰ *REMINDER!*\n\n📝 ${reminder.task}\n\n_This reminder was set ${this._formatDuration(reminder.duration)} ago_`;

        if (this.sock) {
            try {
                await this.sock.sendMessage(reminder.contactId, { text: msg });
                console.log(`⏰ Reminder #${id} fired for ${reminder.contactId}`);
            } catch (error) {
                console.error(`❌ Failed to send reminder #${id}:`, error.message);
            }
        }

        this.reminders.delete(id);
    }

    /**
     * List active reminders for a contact
     */
    _listReminders(contactId) {
        const userReminders = [];
        for (const [id, r] of this.reminders) {
            if (r.contactId === contactId) {
                const remaining = Math.max(0, r.triggerTime - Date.now());
                userReminders.push(`#${id}: ${r.task} (in ${this._formatDuration(remaining)})`);
            }
        }

        if (userReminders.length === 0) {
            return {
                response: "⏰ No active reminders! Set one with:\n_remind me in 30 min to take a break_",
                source: 'reminder-engine/list',
                isQuickResponse: true
            };
        }

        return {
            response: `⏰ *Active Reminders:*\n\n${userReminders.join('\n')}\n\n_Send "cancel reminder #ID" to cancel_`,
            source: 'reminder-engine/list',
            isQuickResponse: true
        };
    }

    /**
     * Cancel a reminder
     */
    _cancelReminder(id, contactId) {
        const reminder = this.reminders.get(id);
        if (!reminder) {
            return {
                response: `⏰ Reminder #${id} not found. Send "list reminders" to see active ones.`,
                source: 'reminder-engine/cancel',
                isQuickResponse: true
            };
        }

        if (reminder.contactId !== contactId) {
            return {
                response: `⏰ That reminder doesn't belong to you.`,
                source: 'reminder-engine/cancel',
                isQuickResponse: true
            };
        }

        clearTimeout(reminder.timer);
        this.reminders.delete(id);

        return {
            response: `✅ Reminder #${id} cancelled: ${reminder.task}`,
            source: 'reminder-engine/cancel',
            isQuickResponse: true
        };
    }

    /**
     * Parse natural language duration to milliseconds
     */
    _parseDuration(text) {
        const t = text.toLowerCase().trim();
        let totalMs = 0;

        // Match patterns like "2 hours 30 minutes" or "2h30m"
        const patterns = [
            { regex: /(\d+)\s*(?:hour|hr|h)s?/i, multiplier: 3600000 },
            { regex: /(\d+)\s*(?:minute|min|m)(?:s|ute)?/i, multiplier: 60000 },
            { regex: /(\d+)\s*(?:second|sec|s)s?/i, multiplier: 1000 },
        ];

        for (const { regex, multiplier } of patterns) {
            const match = t.match(regex);
            if (match) {
                totalMs += parseInt(match[1]) * multiplier;
            }
        }

        // Fallback: just a number = minutes
        if (totalMs === 0) {
            const num = parseInt(t);
            if (!isNaN(num)) {
                totalMs = num * 60000; // assume minutes
            }
        }

        // Half hour
        if (/half\s*(an?\s*)?hour/i.test(t)) totalMs = 1800000;

        return totalMs > 0 ? totalMs : null;
    }

    /**
     * Format milliseconds to human readable
     */
    _formatDuration(ms) {
        if (ms < 60000) return `${Math.round(ms / 1000)}s`;
        if (ms < 3600000) return `${Math.round(ms / 60000)} min`;
        const hours = Math.floor(ms / 3600000);
        const mins = Math.round((ms % 3600000) / 60000);
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }

    /**
     * Get count of active reminders
     */
    getActiveCount() {
        return this.reminders.size;
    }

    /**
     * Cleanup all reminders
     */
    cleanup() {
        for (const [id, r] of this.reminders) {
            clearTimeout(r.timer);
        }
        this.reminders.clear();
    }
}

module.exports = new ReminderEngine();
