# 🧠 Manthan AI — Ultimate Omni Bot v4.1

> Personal AI assistant that sounds so human, people think Manthan is always online.
> Now with Web Search, YouTube, Voice Notes, Instagram, Summarization, and A/B Testing.

## Architecture

```
Incoming Message (WhatsApp or Instagram)
       ↓
  Trigger Check (group mention? DM? voice request?)
       ↓
  Intent Engine (16 intent categories + sub-intents)
       ↓
  Emotion Engine (12 emotions + intensity scoring)
       ↓
  Memory Fetch (Person Memory + Context + Safety Rules)
       ↓
  Conversation Summarizer (compress long chats)
       ↓
  ┌─────────── Brain Router v4.1 ───────────┐
  │                                         │
  ├─ 💬 Chat Brain (Gemini AI)              │  ← General conversation
  ├─ 📚 Knowledge Brain (NLP + KB)          │  ← Facts about Manthan
  ├─ 🔍 Search Brain (DuckDuckGo)           │  ← Real-time web search
  ├─ 📹 YouTube Brain (API + Invidious)     │  ← Video recommendations
  ├─ 🤝 Social Brain                        │  ← Greetings, thanks, festivals
  └─ 🛡️ Safety Brain                       │  ← Content filter (always runs)
       ↓
  Humanizer (tone matching + typing delay)
       ↓
  Voice Engine (optional TTS voice note)
       ↓
  A/B Testing (track engagement metrics)
       ↓
  Send Response
```

## Intelligence Stack

| Layer | Feature | Status |
|-------|---------|--------|
| **BRAINS** | | |
| 💬 Chat Brain | Gemini 2.5 Flash with model fallback | ✅ |
| 📚 Knowledge Brain | NLP + keyword KB (offline capable) | ✅ |
| 🔍 Search Brain | DuckDuckGo instant + web search | ✅ |
| 📹 YouTube Brain | YouTube API v3 + Invidious fallback | ✅ |
| 🤝 Social Brain | Quick responses with variants | ✅ |
| 🛡️ Safety Brain | AI leak filter + commitment blocker | ✅ |
| **ENGINES** | | |
| 🎯 Intent Engine | 16 intents + sub-intents + confidence | ✅ |
| 💭 Emotion Engine | 12 emotions + intensity + guidance | ✅ |
| 🎭 Humanizer | Typing delay + formality trimming + tone | ✅ |
| 🎤 Voice Engine | Google TTS → WhatsApp voice notes | ✅ |
| 📝 Summarizer | Context compression + daily digests | ✅ |
| 🧪 A/B Testing | Epsilon-greedy bandit, 5 experiments | ✅ |
| **MEMORY** | | |
| 🗄️ Memory Store | SQLite persistent (persons, context, safety) | ✅ |
| 👤 Owner Takeover | Auto-pause when Manthan replies | ✅ |
| 🕐 Time Awareness | Late night, work hours, morning vibes | ✅ |
| 🌐 Language Detection | English / Hindi / Hinglish | ✅ |
| 🔄 Self-Reflection | AI identity leak removal + group trimming | ✅ |
| **PLATFORMS** | | |
| 📱 WhatsApp | Full integration with Baileys | ✅ |
| 📸 Instagram | Meta Graph API webhooks (DMs, stories, mentions) | ✅ |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up API key
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 3. Start the bot
npm start
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `PORT` | ❌ | Web server port (default: 3000) |
| `YOUTUBE_API_KEY` | ❌ | YouTube Data API v3 (falls back to Invidious) |
| `INSTAGRAM_ACCESS_TOKEN` | ❌ | Meta Graph API token |
| `INSTAGRAM_ACCOUNT_ID` | ❌ | Instagram Business Account ID |
| `INSTAGRAM_VERIFY_TOKEN` | ❌ | Webhook verification token |

## Owner Commands (send from your WhatsApp)

| Command | Action |
|---------|--------|
| `/bot on` or `/resume` | Resume bot for a conversation |
| `/bot off` or `/pause` | Pause bot for a conversation |
| `/stats` | Show memory & uptime stats |
| `/ab` or `/ab report` | Show A/B testing results |
| `/digest` | Show today's conversation summary |

## Web Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | QR code page for WhatsApp connection |
| `GET /health` | Health check + stats JSON |
| `GET /ab-report` | A/B testing results |
| `GET /digest` | Daily conversation digest |
| `POST /webhook/instagram` | Instagram webhook receiver |

## Features In Detail

### 🔍 Web Search Brain
- Uses DuckDuckGo (no API key needed)
- Instant answers for definitions, calculations
- HTML search fallback for web results
- 10-minute result caching
- Auto-detects search intent from natural language

### 📹 YouTube Brain
- Uses YouTube Data API v3 (when key available)
- Falls back to Invidious API (no key needed)
- Shows title, channel, duration, views
- 30-minute result caching

### 🎤 Voice Reply
- Say "voice", "audio", "bol", "read it" to get a voice note
- Uses Google TTS (no API key needed)
- Auto-detects Hindi vs English
- Handles long text by chunking

### 📸 Instagram Integration
- Handles DMs, story replies, and story mentions
- Comment mention detection
- Uses the same Brain Router as WhatsApp
- Requires Meta Graph API setup

### 📝 Conversation Summarizer
- Auto-summarizes when conversations exceed 15 messages
- Context compression: summary + last 5 messages (instead of all 30)
- Daily digest at 11 PM
- Uses Gemini with local fallback

### 🧪 A/B Testing
- 5 active experiments: greeting style, response length, temperature, emoji usage, follow-up questions
- Epsilon-greedy multi-armed bandit (20% explore, 80% exploit)
- Engagement tracking: reply rate, speed, sentiment
- Auto-declares winners at 50+ samples with 15% improvement

## Group Behavior

- Only responds when **mentioned** (@manthan, @bot), **quoted**, or **name-mentioned**
- Keeps replies short and witty
- Auto-trims long responses to 1-2 sentences
- Quotes the original message in reply

## File Structure

```
UltimateBot/
├── bot.js                              # Main entry point (Express + Baileys)
├── config/
│   └── personal-config.json            # Profile, KB, intelligence settings
├── src/
│   ├── brains/
│   │   ├── brain-router.js             # Multi-brain orchestrator v4.1
│   │   ├── chat-brain.js               # Gemini AI (primary)
│   │   ├── knowledge-brain.js          # NLP + KB (offline)
│   │   ├── search-brain.js             # 🆕 DuckDuckGo web search
│   │   ├── youtube-brain.js            # 🆕 YouTube search + recommend
│   │   ├── social-brain.js             # Quick social responses
│   │   ├── safety-brain.js             # Content filter
│   │   └── humanizer.js               # Tone + delay adjustment
│   ├── engines/
│   │   ├── voice-engine.js             # 🆕 Google TTS voice notes
│   │   ├── summarizer.js              # 🆕 Conversation summarization
│   │   └── ab-testing.js             # 🆕 A/B test framework
│   ├── intelligence/
│   │   ├── intent-engine.js            # Intent + sub-intent detection
│   │   └── emotion-engine.js           # Emotion + intensity detection
│   ├── memory/
│   │   └── memory-store.js             # SQLite persistent memory
│   ├── platforms/
│   │   └── instagram-interface.js      # 🆕 Meta Graph API integration
│   └── utils/
│       └── config-loader.js            # Config + system prompt generator
├── data/                               # SQLite DB + temp files (auto-created)
├── info.txt                            # Detailed bio for RAG context
└── .env                                # API keys
```

## Performance

| Brain | Typical Response Time |
|-------|----------------------|
| Social Brain | **4-10ms** (instant) |
| Knowledge Brain (NLP) | **50-100ms** |
| Search Brain | **500-1500ms** |
| YouTube Brain | **1-3s** |
| Chat Brain (Gemini) | **2-5s** |
| Voice + Text | **+2-4s** additional |

## Author

**Manthan Dhole** — Software Engineer & Researcher
