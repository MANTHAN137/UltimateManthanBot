/**
 * Auto-Reply Engine — Smart away/DND modes for the owner
 * 
 * Modes:
 * - /away <message> — Custom away message for all incoming
 * - /dnd — Do not disturb, bot ignores all messages
 * - /busy <duration> — Busy for X time, with auto-resume
 * - /auto <message> — Auto-reply with custom message
 * - /online — Back to normal mode
 */

class AutoReplyEngine {
    constructor() {
        this.mode = 'online'; // online | away | dnd | busy
        this.customMessage = null;
        this.busyTimer = null;
        this.busyUntil = null;
        console.log('🕒 Auto-Reply Engine initialized');
    }

    /**
     * Get current mode
     */
    getMode() {
        // Check if busy timer expired
        if (this.mode === 'busy' && this.busyUntil && Date.now() > this.busyUntil) {
            this.mode = 'online';
            this.customMessage = null;
            this.busyUntil = null;
            console.log('🕒 Busy mode expired, back online');
        }
        return this.mode;
    }

    /**
     * Handle owner command for mode changes
     * Returns true if handled, false if not a mode command
     */
    handleCommand(command) {
        const cmd = command.toLowerCase().trim();

        // /online or /back
        if (/^\/(online|back|normal)$/.test(cmd)) {
            this._clearBusy();
            this.mode = 'online';
            this.customMessage = null;
            return { handled: true, response: '✅ Bot is back *online*! Responding normally.' };
        }

        // /dnd
        if (/^\/dnd$/.test(cmd)) {
            this._clearBusy();
            this.mode = 'dnd';
            this.customMessage = null;
            return { handled: true, response: '🔇 *DND mode ON*. Bot will ignore all messages.\nSend /online to resume.' };
        }

        // /away <message>
        const awayMatch = cmd.match(/^\/away\s+(.+)/);
        if (awayMatch) {
            this._clearBusy();
            this.mode = 'away';
            this.customMessage = awayMatch[1].trim();
            return { handled: true, response: `🌙 *Away mode ON*\nAuto-reply: "${this.customMessage}"\nSend /online to resume.` };
        }

        // /away (no message)
        if (/^\/away$/.test(cmd)) {
            this._clearBusy();
            this.mode = 'away';
            this.customMessage = "Hey! I'm away right now. Will get back to you soon 🙏";
            return { handled: true, response: `🌙 *Away mode ON*\nUsing default away message.\nSend /online to resume.` };
        }

        // /busy <duration>
        const busyMatch = cmd.match(/^\/busy\s+(.+)/);
        if (busyMatch) {
            const duration = this._parseDuration(busyMatch[1]);
            if (!duration) {
                return { handled: true, response: '⚠️ Invalid duration. Try: /busy 2 hours' };
            }
            this._clearBusy();
            this.mode = 'busy';
            this.busyUntil = Date.now() + duration;
            this.customMessage = `I'm busy right now. Will be available in ${this._formatDuration(duration)} 🙏`;
            this.busyTimer = setTimeout(() => {
                this.mode = 'online';
                this.customMessage = null;
                this.busyUntil = null;
                console.log('🕒 Busy mode expired, back online');
            }, duration);
            return { handled: true, response: `⏰ *Busy mode ON* for ${this._formatDuration(duration)}\nAuto-reply enabled. Will auto-resume.\nSend /online to resume early.` };
        }

        // /auto <message>
        const autoMatch = cmd.match(/^\/auto\s+(.+)/);
        if (autoMatch) {
            this._clearBusy();
            this.mode = 'away';
            this.customMessage = autoMatch[1].trim();
            return { handled: true, response: `🤖 *Auto-reply ON*\nMessage: "${this.customMessage}"\nSend /online to stop.` };
        }

        // /status
        if (/^\/status$/.test(cmd)) {
            let status = `🕒 *Bot Status:* ${this.mode.toUpperCase()}`;
            if (this.customMessage) status += `\n📝 Auto-reply: "${this.customMessage}"`;
            if (this.busyUntil) {
                const remaining = Math.max(0, this.busyUntil - Date.now());
                status += `\n⏳ Busy for: ${this._formatDuration(remaining)}`;
            }
            return { handled: true, response: status };
        }

        return { handled: false };
    }

    /**
     * Get auto-reply message if in away/busy mode
     * Returns null if mode is online (bot should respond normally)
     */
    getAutoReply(contactId) {
        const mode = this.getMode();

        if (mode === 'online') return null;
        if (mode === 'dnd') return '__DND__'; // Special flag: don't reply at all

        // away or busy
        return this.customMessage || "Hey! I'm away right now. Will get back to you soon 🙏";
    }

    _clearBusy() {
        if (this.busyTimer) {
            clearTimeout(this.busyTimer);
            this.busyTimer = null;
        }
        this.busyUntil = null;
    }

    _parseDuration(text) {
        const t = text.toLowerCase().trim();
        let ms = 0;
        const patterns = [
            { regex: /(\d+)\s*(?:hour|hr|h)s?/i, mult: 3600000 },
            { regex: /(\d+)\s*(?:minute|min|m)(?:s|ute)?/i, mult: 60000 },
        ];
        for (const { regex, mult } of patterns) {
            const m = t.match(regex);
            if (m) ms += parseInt(m[1]) * mult;
        }
        if (ms === 0) {
            const n = parseInt(t);
            if (!isNaN(n)) ms = n * 60000; // assume minutes
        }
        if (/half\s*hour/i.test(t)) ms = 1800000;
        return ms > 0 ? ms : null;
    }

    _formatDuration(ms) {
        if (ms < 60000) return `${Math.round(ms / 1000)}s`;
        if (ms < 3600000) return `${Math.round(ms / 60000)} min`;
        const h = Math.floor(ms / 3600000);
        const m = Math.round((ms % 3600000) / 60000);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
}

module.exports = new AutoReplyEngine();
