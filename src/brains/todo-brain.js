/**
 * Todo Brain v1.0
 * Full-featured to-do list manager for WhatsApp chat
 *
 * Features:
 * - Add / complete / delete / edit tasks
 * - Priority levels (high, medium, low)
 * - Categories (work, personal, health, study, etc.)
 * - Progress tracking with visual bar
 * - Daily summaries & motivational messages
 * - Persistent SQLite storage (survives restarts)
 *
 * Commands:
 *   "add task: buy groceries"
 *   "todo buy milk"
 *   "done 3" / "complete 3"
 *   "delete task 3"
 *   "my tasks" / "show list" / "todo list"
 *   "progress" / "my progress"
 *   "clear completed"
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/todo.db');

class TodoBrain {
    constructor() {
        this.db = null;
        this._ready = false;
        this._readyPromise = this._init();

        this.motivations = [
            "💪 Keep pushing! Every task done is a step forward.",
            "🔥 You're on fire today! Keep that momentum going.",
            "⭐ Small progress is still progress. You got this!",
            "🚀 Productivity level: superhuman! Keep going.",
            "🎯 Focus mode activated. One task at a time.",
            "👑 You're crushing it today!",
            "💯 Consistency beats intensity. Keep it steady.",
            "🌟 Another one bites the dust! Great work.",
            "🏆 Champions don't skip tasks. Let's go!",
            "✨ You're building momentum. Don't stop now!"
        ];

        this.categoryEmojis = {
            work: '💼', personal: '🏠', health: '🏋️', study: '📚',
            finance: '💰', social: '👥', shopping: '🛒', project: '🔧',
            urgent: '🚨', other: '📌'
        };

        this.priorityLabels = {
            high: '🔴', medium: '🟡', low: '🟢'
        };

        console.log('📋 Todo Brain initialized');
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

        this.db.run(`CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contact_id TEXT NOT NULL,
            task TEXT NOT NULL,
            category TEXT DEFAULT 'other',
            priority TEXT DEFAULT 'medium',
            completed INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            completed_at TEXT
        )`);

        this._saveInterval = setInterval(() => this._saveToDisk(), 30000);
        this._ready = true;
        console.log('📋 Todo database ready');
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
            console.error('❌ Todo DB save error:', e.message);
        }
    }

    // ═══════════════════════════════════════
    // REQUEST DETECTION
    // ═══════════════════════════════════════

    isTodoRequest(message) {
        const msg = message.toLowerCase();
        return /\b(todo|to-do|to do|task|tasklist|task list|add task|my tasks|show list|show tasks|done \d|complete \d|delete task|remove task|clear completed|my progress|todo progress|mark done|check off)\b/i.test(msg);
    }

    // ═══════════════════════════════════════
    // MAIN PROCESS
    // ═══════════════════════════════════════

    async process(message, contactId) {
        await this.ensureReady();
        const msg = message.trim();
        const lower = msg.toLowerCase();

        // Show tasks
        if (/^(my tasks|show ?(my )?tasks|todo ?list|show ?list|list ?tasks|tasks|todos)$/i.test(lower)) {
            return this._showTasks(contactId);
        }

        // Progress
        if (/^(progress|my progress|todo progress|how am i doing|task stats)$/i.test(lower)) {
            return this._showProgress(contactId);
        }

        // Clear completed
        if (/^(clear completed|remove completed|clean ?up|clear done)$/i.test(lower)) {
            return this._clearCompleted(contactId);
        }

        // Complete a task: "done 3", "complete 3", "mark done 3", "check 3"
        const doneMatch = lower.match(/(?:done|complete|mark done|check|finish|✅)\s*#?(\d+)/i);
        if (doneMatch) {
            return this._completeTask(parseInt(doneMatch[1]), contactId);
        }

        // Undo a task: "undo 3"
        const undoMatch = lower.match(/(?:undo|uncheck|reopen)\s*#?(\d+)/i);
        if (undoMatch) {
            return this._undoTask(parseInt(undoMatch[1]), contactId);
        }

        // Delete a task: "delete task 3", "remove task 3", "delete 3"
        const deleteMatch = lower.match(/(?:delete|remove|del)\s*(?:task\s*)?#?(\d+)/i);
        if (deleteMatch) {
            return this._deleteTask(parseInt(deleteMatch[1]), contactId);
        }

        // Add a task: "add task: buy groceries", "todo buy milk", "task: study math"
        const addMatch = msg.match(/(?:add task|new task|todo|task)[:\s]+(.+)/i);
        if (addMatch) {
            return this._addTask(addMatch[1].trim(), contactId);
        }

        // Fallback — try to add whatever they said as a task
        if (/^(add|todo)\s+/i.test(lower)) {
            const taskText = msg.replace(/^(add|todo)\s+/i, '').trim();
            if (taskText.length > 1) {
                return this._addTask(taskText, contactId);
            }
        }

        // Help
        return this._showHelp();
    }

    // ═══════════════════════════════════════
    // TASK OPERATIONS
    // ═══════════════════════════════════════

    _addTask(taskText, contactId) {
        // Detect priority
        let priority = 'medium';
        if (/!{3}|urgent|asap|critical/i.test(taskText)) priority = 'high';
        else if (/!{2}|important|priority/i.test(taskText)) priority = 'high';
        else if (/low(\s+priority)?|whenever|no rush/i.test(taskText)) priority = 'low';

        // Detect category
        let category = 'other';
        if (/\b(work|office|meeting|client|project|deadline)\b/i.test(taskText)) category = 'work';
        else if (/\b(gym|exercise|workout|health|doctor|medicine|walk|run)\b/i.test(taskText)) category = 'health';
        else if (/\b(study|exam|homework|class|learn|read|book)\b/i.test(taskText)) category = 'study';
        else if (/\b(buy|shop|grocery|groceries|store|order|amazon)\b/i.test(taskText)) category = 'shopping';
        else if (/\b(pay|bill|emi|rent|invest|bank|money|salary)\b/i.test(taskText)) category = 'finance';
        else if (/\b(call|meet|party|birthday|friend|family)\b/i.test(taskText)) category = 'social';
        else if (/\b(home|clean|cook|laundry|repair|fix)\b/i.test(taskText)) category = 'personal';

        // Clean task text
        const cleanTask = taskText
            .replace(/!{2,}|urgent|asap|critical|important|priority|low priority|no rush/gi, '')
            .replace(/\s+/g, ' ').trim();

        this.db.run(
            'INSERT INTO todos (contact_id, task, category, priority) VALUES (?, ?, ?, ?)',
            [contactId, cleanTask, category, priority]
        );
        this._saveToDisk();

        // Get the ID of the just-inserted task
        const result = this.db.exec('SELECT last_insert_rowid() as id');
        const id = result[0]?.values[0]?.[0] || '?';

        const emoji = this.categoryEmojis[category] || '📌';
        const prio = this.priorityLabels[priority];

        // Count total tasks
        const stats = this._getStats(contactId);

        let response = `✅ *Task Added!*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        response += `${emoji} *#${id}* — ${cleanTask}\n`;
        response += `${prio} Priority: ${priority}\n\n`;
        response += `📊 Total: ${stats.total} tasks (${stats.completed} done, ${stats.pending} pending)\n\n`;
        response += `_"done ${id}" to complete • "my tasks" to see all_`;

        return {
            response,
            source: 'todo-brain/add',
            isQuickResponse: true
        };
    }

    _completeTask(id, contactId) {
        const task = this._getTask(id, contactId);
        if (!task) {
            return {
                response: `❌ Task #${id} not found. Send "my tasks" to see your list.`,
                source: 'todo-brain/error',
                isQuickResponse: true
            };
        }

        if (task.completed) {
            return {
                response: `✔️ Task #${id} is already completed!`,
                source: 'todo-brain/error',
                isQuickResponse: true
            };
        }

        this.db.run(
            "UPDATE todos SET completed = 1, completed_at = datetime('now') WHERE id = ? AND contact_id = ?",
            [id, contactId]
        );
        this._saveToDisk();

        const stats = this._getStats(contactId);
        const motivation = this.motivations[Math.floor(Math.random() * this.motivations.length)];
        const progressBar = this._makeProgressBar(stats.completed, stats.total);

        let response = `✅ *Task Completed!*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        response += `~${task.task}~ ✔️\n\n`;
        response += `${progressBar}\n`;
        response += `📊 ${stats.completed}/${stats.total} tasks done\n\n`;
        response += `${motivation}`;

        if (stats.pending === 0 && stats.total > 0) {
            response += `\n\n🎉🎉🎉 *ALL TASKS COMPLETE!* You're a legend! 🎉🎉🎉`;
        }

        return {
            response,
            source: 'todo-brain/complete',
            isQuickResponse: true
        };
    }

    _undoTask(id, contactId) {
        const task = this._getTask(id, contactId);
        if (!task) {
            return {
                response: `❌ Task #${id} not found.`,
                source: 'todo-brain/error',
                isQuickResponse: true
            };
        }

        this.db.run(
            'UPDATE todos SET completed = 0, completed_at = NULL WHERE id = ? AND contact_id = ?',
            [id, contactId]
        );
        this._saveToDisk();

        return {
            response: `↩️ Task #${id} reopened: *${task.task}*`,
            source: 'todo-brain/undo',
            isQuickResponse: true
        };
    }

    _deleteTask(id, contactId) {
        const task = this._getTask(id, contactId);
        if (!task) {
            return {
                response: `❌ Task #${id} not found.`,
                source: 'todo-brain/error',
                isQuickResponse: true
            };
        }

        this.db.run('DELETE FROM todos WHERE id = ? AND contact_id = ?', [id, contactId]);
        this._saveToDisk();

        return {
            response: `🗑️ Task #${id} deleted: _${task.task}_`,
            source: 'todo-brain/delete',
            isQuickResponse: true
        };
    }

    _clearCompleted(contactId) {
        const result = this.db.exec(
            'SELECT COUNT(*) FROM todos WHERE contact_id = ? AND completed = 1',
            [contactId]
        );
        const count = result[0]?.values[0]?.[0] || 0;

        if (count === 0) {
            return {
                response: '📋 No completed tasks to clear.',
                source: 'todo-brain/clear',
                isQuickResponse: true
            };
        }

        this.db.run('DELETE FROM todos WHERE contact_id = ? AND completed = 1', [contactId]);
        this._saveToDisk();

        return {
            response: `🗑️ Cleared ${count} completed task${count > 1 ? 's' : ''}. Fresh start! 🧹`,
            source: 'todo-brain/clear',
            isQuickResponse: true
        };
    }

    // ═══════════════════════════════════════
    // DISPLAY
    // ═══════════════════════════════════════

    _showTasks(contactId) {
        const rows = this.db.exec(
            'SELECT id, task, category, priority, completed FROM todos WHERE contact_id = ? ORDER BY completed ASC, priority DESC, id ASC',
            [contactId]
        );

        if (!rows[0] || rows[0].values.length === 0) {
            return {
                response: `📋 *Your Todo List*\n━━━━━━━━━━━━━━━━━━━━\n\n_No tasks yet!_ Start adding with:\n\n• _"todo buy groceries"_\n• _"add task: study for exam"_\n• _"todo call dentist !!"_`,
                source: 'todo-brain/list',
                isQuickResponse: true
            };
        }

        const tasks = rows[0].values;
        const stats = this._getStats(contactId);
        const progressBar = this._makeProgressBar(stats.completed, stats.total);

        let response = `📋 *Your Todo List*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        response += `${progressBar}\n📊 ${stats.completed}/${stats.total} done\n\n`;

        // Pending tasks
        const pending = tasks.filter(t => !t[4]);
        const completed = tasks.filter(t => t[4]);

        if (pending.length > 0) {
            response += `*⏳ Pending (${pending.length})*\n`;
            pending.forEach(t => {
                const [id, task, category, priority] = t;
                const catEmoji = this.categoryEmojis[category] || '📌';
                const prioEmoji = this.priorityLabels[priority] || '🟡';
                response += `${prioEmoji} *#${id}* ${catEmoji} ${task}\n`;
            });
        }

        if (completed.length > 0) {
            response += `\n*✅ Done (${completed.length})*\n`;
            completed.slice(0, 5).forEach(t => {
                response += `✔️ ~#${t[0]} ${t[1]}~\n`;
            });
            if (completed.length > 5) {
                response += `_...and ${completed.length - 5} more_\n`;
            }
        }

        response += `\n─────────────────────\n`;
        response += `💡 _"done #ID" • "delete #ID" • "todo [task]"_`;

        return {
            response,
            source: 'todo-brain/list',
            isQuickResponse: false
        };
    }

    _showProgress(contactId) {
        const stats = this._getStats(contactId);

        if (stats.total === 0) {
            return {
                response: `📊 *Your Progress*\n━━━━━━━━━━━━━━━━━━━━\n\nNo tasks yet! Add some with:\n_"todo [your task]"_`,
                source: 'todo-brain/progress',
                isQuickResponse: true
            };
        }

        const progressBar = this._makeProgressBar(stats.completed, stats.total);
        const percentage = Math.round((stats.completed / stats.total) * 100);

        // Category breakdown
        const catRows = this.db.exec(
            `SELECT category, 
                    COUNT(*) as total,
                    SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as done 
             FROM todos WHERE contact_id = ? GROUP BY category`,
            [contactId]
        );

        let response = `📊 *Your Progress Report*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        response += `${progressBar}\n`;
        response += `🎯 *${percentage}%* complete (${stats.completed}/${stats.total})\n\n`;

        if (catRows[0] && catRows[0].values.length > 0) {
            response += `*By Category:*\n`;
            catRows[0].values.forEach(row => {
                const [cat, total, done] = row;
                const emoji = this.categoryEmojis[cat] || '📌';
                response += `${emoji} ${cat}: ${done}/${total} done\n`;
            });
        }

        // Priority breakdown
        response += `\n*By Priority:*\n`;
        response += `🔴 High: ${stats.highPending} pending\n`;
        response += `🟡 Medium: ${stats.medPending} pending\n`;
        response += `🟢 Low: ${stats.lowPending} pending\n`;

        // Motivational message based on percentage
        response += `\n─────────────────────\n`;
        if (percentage === 100) {
            response += `🎉 *PERFECT!* All tasks done! You're unstoppable! 🏆`;
        } else if (percentage >= 75) {
            response += `🔥 Almost there! Just ${stats.pending} more to go!`;
        } else if (percentage >= 50) {
            response += `💪 Halfway there! Keep the momentum going!`;
        } else if (percentage >= 25) {
            response += `⭐ Good start! Pick up the pace, you got this!`;
        } else {
            response += `🚀 Time to get things done! Start with the high-priority ones.`;
        }

        return {
            response,
            source: 'todo-brain/progress',
            isQuickResponse: false
        };
    }

    _showHelp() {
        return {
            response: `📋 *Todo List Commands*\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `*Add Tasks:*\n` +
                `• _"todo buy groceries"_\n` +
                `• _"add task: call dentist"_\n` +
                `• _"todo study for exam !!"_ (high priority)\n\n` +
                `*Manage:*\n` +
                `• _"done 3"_ — mark #3 complete\n` +
                `• _"delete 3"_ — remove task #3\n` +
                `• _"undo 3"_ — reopen task #3\n\n` +
                `*View:*\n` +
                `• _"my tasks"_ — see your list\n` +
                `• _"progress"_ — see your stats\n` +
                `• _"clear completed"_ — clean up\n\n` +
                `_Categories & priority are auto-detected!_ 🤖`,
            source: 'todo-brain/help',
            isQuickResponse: false
        };
    }

    // ═══════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════

    _getTask(id, contactId) {
        const result = this.db.exec(
            'SELECT id, task, category, priority, completed FROM todos WHERE id = ? AND contact_id = ?',
            [id, contactId]
        );
        if (!result[0] || result[0].values.length === 0) return null;
        const [tid, task, category, priority, completed] = result[0].values[0];
        return { id: tid, task, category, priority, completed };
    }

    _getStats(contactId) {
        const result = this.db.exec(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN completed = 0 AND priority = 'high' THEN 1 ELSE 0 END) as highPending,
                SUM(CASE WHEN completed = 0 AND priority = 'medium' THEN 1 ELSE 0 END) as medPending,
                SUM(CASE WHEN completed = 0 AND priority = 'low' THEN 1 ELSE 0 END) as lowPending
            FROM todos WHERE contact_id = ?
        `, [contactId]);

        if (!result[0] || result[0].values.length === 0) {
            return { total: 0, completed: 0, pending: 0, highPending: 0, medPending: 0, lowPending: 0 };
        }

        const [total, completed, pending, highPending, medPending, lowPending] = result[0].values[0];
        return {
            total: total || 0,
            completed: completed || 0,
            pending: pending || 0,
            highPending: highPending || 0,
            medPending: medPending || 0,
            lowPending: lowPending || 0
        };
    }

    _makeProgressBar(completed, total) {
        if (total === 0) return '▱▱▱▱▱▱▱▱▱▱ 0%';
        const percentage = Math.round((completed / total) * 100);
        const filled = Math.round(percentage / 10);
        const empty = 10 - filled;
        return '▰'.repeat(filled) + '▱'.repeat(empty) + ` ${percentage}%`;
    }

    /**
     * Get daily summary for a contact (can be called by other brains)
     */
    async getDailySummary(contactId) {
        await this.ensureReady();
        const stats = this._getStats(contactId);
        if (stats.total === 0) return null;

        const progressBar = this._makeProgressBar(stats.completed, stats.total);
        const motivation = this.motivations[Math.floor(Math.random() * this.motivations.length)];

        let summary = `📋 *Daily Task Update*\n${progressBar}\n`;
        summary += `${stats.completed}/${stats.total} done • ${stats.pending} pending`;

        if (stats.highPending > 0) {
            summary += `\n🔴 ${stats.highPending} high-priority task${stats.highPending > 1 ? 's' : ''} pending!`;
        }

        summary += `\n\n${motivation}`;
        return summary;
    }
}

module.exports = new TodoBrain();
