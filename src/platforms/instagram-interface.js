/**
 * Instagram Interface
 * DM replies and story reply handling via Meta Graph API
 * 
 * Setup:
 * 1. Create a Meta Developer App
 * 2. Add Instagram Product
 * 3. Get Page Access Token + Instagram Business Account ID
 * 4. Subscribe to webhook events (messages, story_replies)
 * 
 * Env vars needed:
 * - INSTAGRAM_ACCESS_TOKEN
 * - INSTAGRAM_ACCOUNT_ID
 * - INSTAGRAM_VERIFY_TOKEN (for webhook verification)
 */

const config = require('../utils/config-loader');

class InstagramInterface {
    constructor() {
        this.accessToken = process.env.INSTAGRAM_ACCESS_TOKEN || null;
        this.accountId = process.env.INSTAGRAM_ACCOUNT_ID || null;
        this.verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN || 'manthan_bot_verify_2024';
        this.GRAPH_API = 'https://graph.instagram.com/v21.0';

        this.isConfigured = !!(this.accessToken && this.accountId);

        if (this.isConfigured) {
            console.log('📸 Instagram Interface initialized (Meta Graph API ✓)');
        } else {
            console.log('📸 Instagram Interface initialized (not configured — set INSTAGRAM_ACCESS_TOKEN & INSTAGRAM_ACCOUNT_ID)');
        }
    }

    /**
     * Set up webhook routes on an Express app
     * @param {Object} app - Express app instance
     * @param {Function} messageHandler - async (senderId, messageText, messageType) => response
     */
    setupWebhook(app, messageHandler) {
        if (!this.isConfigured) {
            console.log('   ⚠️ Instagram webhook not set up (missing credentials)');
            return;
        }

        // Webhook verification (GET)
        app.get('/webhook/instagram', (req, res) => {
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];

            if (mode === 'subscribe' && token === this.verifyToken) {
                console.log('📸 Instagram webhook verified!');
                return res.status(200).send(challenge);
            }

            console.log('❌ Instagram webhook verification failed');
            return res.sendStatus(403);
        });

        // Incoming messages (POST)
        app.post('/webhook/instagram', async (req, res) => {
            // Always respond 200 quickly to avoid timeouts
            res.sendStatus(200);

            try {
                const body = req.body;

                if (body.object !== 'instagram') return;

                for (const entry of body.entry || []) {
                    // Handle messaging events
                    for (const event of entry.messaging || []) {
                        await this._handleMessagingEvent(event, messageHandler);
                    }

                    // Handle changes (comments, story mentions, etc.)
                    for (const change of entry.changes || []) {
                        await this._handleChangeEvent(change, messageHandler);
                    }
                }

            } catch (error) {
                console.error('❌ Instagram webhook error:', error.message);
            }
        });

        console.log('📸 Instagram webhook routes registered (/webhook/instagram)');
    }

    /**
     * Handle incoming DM or story reply
     */
    async _handleMessagingEvent(event, messageHandler) {
        const senderId = event.sender?.id;
        const recipientId = event.recipient?.id;

        // Skip our own messages
        if (senderId === this.accountId) return;

        // Text message
        if (event.message?.text) {
            const messageText = event.message.text;
            const messageType = event.message?.reply_to ? 'story_reply' : 'dm';

            console.log(`\n📸 Instagram ${messageType}: ${messageText}`);

            try {
                // Get response from brain
                const response = await messageHandler(senderId, messageText, messageType);

                if (response) {
                    await this.sendMessage(senderId, response);
                }
            } catch (error) {
                console.error(`   ❌ Instagram handler error: ${error.message}`);
            }
        }

        // Story mention
        if (event.message?.attachments) {
            for (const attachment of event.message.attachments) {
                if (attachment.type === 'story_mention') {
                    console.log(`\n📸 Instagram: Someone mentioned us in their story!`);

                    try {
                        const response = await messageHandler(
                            senderId,
                            '[Story Mention] Someone mentioned you in their story',
                            'story_mention'
                        );

                        if (response) {
                            await this.sendMessage(senderId, response);
                        }
                    } catch (error) {
                        console.error(`   ❌ Story mention handler error: ${error.message}`);
                    }
                }
            }
        }
    }

    /**
     * Handle change events (comments, etc.)
     */
    async _handleChangeEvent(change, messageHandler) {
        if (change.field === 'comments') {
            const comment = change.value;

            // Check if we're mentioned in a comment
            if (comment.text && /manthan|@manthan/i.test(comment.text)) {
                console.log(`\n📸 Instagram comment mention: ${comment.text}`);

                try {
                    const response = await messageHandler(
                        comment.from?.id || 'unknown',
                        comment.text,
                        'comment_mention'
                    );

                    if (response && comment.id) {
                        await this.replyToComment(comment.id, response);
                    }
                } catch (error) {
                    console.error(`   ❌ Comment handler error: ${error.message}`);
                }
            }
        }
    }

    /**
     * Send a DM via Instagram
     */
    async sendMessage(recipientId, text) {
        if (!this.isConfigured) return false;

        try {
            const response = await fetch(`${this.GRAPH_API}/me/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: { text }
                }),
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            console.log(`   📸 Instagram DM sent to ${recipientId}`);
            return true;

        } catch (error) {
            console.error(`   ❌ Instagram send error: ${error.message}`);
            return false;
        }
    }

    /**
     * Reply to an Instagram comment
     */
    async replyToComment(commentId, text) {
        if (!this.isConfigured) return false;

        try {
            const response = await fetch(`${this.GRAPH_API}/${commentId}/replies`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: JSON.stringify({ message: text }),
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            console.log(`   📸 Instagram comment reply sent`);
            return true;

        } catch (error) {
            console.error(`   ❌ Instagram comment reply error: ${error.message}`);
            return false;
        }
    }

    /**
     * Get user profile info from Instagram
     */
    async getUserProfile(userId) {
        if (!this.isConfigured) return null;

        try {
            const response = await fetch(
                `${this.GRAPH_API}/${userId}?fields=username,name&access_token=${this.accessToken}`,
                { signal: AbortSignal.timeout(5000) }
            );

            if (!response.ok) return null;

            return await response.json();

        } catch {
            return null;
        }
    }
}

module.exports = new InstagramInterface();
