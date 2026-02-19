# 🧠 Manthan AI — Ultimate Omni Bot v4.1

## Complete Feature List & Example Prompts

---

### 💬 1. AI Chat (Gemini AI)
General conversation with human-like responses, context awareness, and personality.

| Example Prompt | What It Does |
|---|---|
| `Hey, how are you?` | Natural conversation |
| `What do you think about AI?` | Opinionated discussion |
| `Tell me something interesting` | Fun facts / trivia |
| *(reply to a message)* `What do you mean by this?` | Context-aware reply using quoted message |

---

### 🔍 2. Web Search (DuckDuckGo)
Searches the web and returns formatted results with links.

| Example Prompt | What It Does |
|---|---|
| `Search for best laptops 2026` | Web search with results |
| `Google how to make pasta` | Search with instant answer |
| `What is quantum computing?` | Knowledge search |

---

### 📹 3. YouTube Search
Finds YouTube videos and returns direct links.

| Example Prompt | What It Does |
|---|---|
| `YouTube how to code in Python` | YouTube video search |
| `Find me a video about cooking biryani` | Video search |
| `YT tutorial React.js` | Short-form YouTube search |

---

### 🎵 4. Music Search + Audio Download
Searches for songs, sends links AND downloads the actual audio to play in chat.

| Example Prompt | What It Does |
|---|---|
| `Play Tum Hi Ho` | Searches + downloads audio |
| `Song Shape of You` | Finds + sends audio file |
| `Play Arijit Singh latest` | Music search + audio |
| `Bajao Excuses AP Dhillon` | Hindi trigger + audio |

---

### 📰 5. News Headlines (Google News)
Fetches latest news from Google News RSS.

| Example Prompt | What It Does |
|---|---|
| `News` | Top headlines |
| `Latest news about technology` | Topic-specific news |
| `What's happening in India?` | Regional news |
| `Show me sports news` | Category news |

---

### 😂 6. Jokes
Fetches jokes from JokeAPI and icanhazdadjoke.

| Example Prompt | What It Does |
|---|---|
| `Tell me a joke` | Random joke |
| `Programming joke` | Tech/coding jokes |
| `Dad joke` | Dad jokes specifically |
| `Dark humor joke` | Category-specific |

---

### 🖼️ 7. Memes (Reddit)
Fetches and sends random memes as images from Reddit.

| Example Prompt | What It Does |
|---|---|
| `Send meme` | Random meme image |
| `Dank meme` | r/dankmemes |
| `Programming meme` | r/ProgrammerHumor |
| `Indian meme` | r/IndianDankMemes |
| `Wholesome meme` | r/wholesomememes |
| `Anime meme` | r/animememes |

---

### 📋 8. Todo List & Task Manager
Full task management with SQLite persistence, categories, priorities, and progress tracking.

| Example Prompt | What It Does |
|---|---|
| `todo buy groceries` | Add a task |
| `add task: study for exam` | Add with "add task" prefix |
| `todo call dentist !!` | Add high-priority task |
| `my tasks` | View all tasks |
| `done 3` | Mark task #3 complete |
| `delete 5` | Delete task #5 |
| `undo 3` | Reopen completed task |
| `progress` | View progress report with stats |
| `clear completed` | Remove all done tasks |

**Auto-detected categories:** work, personal, health, study, shopping, finance, social  
**Auto-detected priorities:** `!!` or `urgent` = high, `low priority` = low

---

### ⏰ 9. Reminders
Set natural language reminders that fire as WhatsApp messages.

| Example Prompt | What It Does |
|---|---|
| `Remind me in 30 min to call mom` | Sets 30-min reminder |
| `Reminder in 2 hours: check email` | Sets 2-hour reminder |
| `Remind me in 1 hour to take a break` | Sets reminder with task |
| `List reminders` | Shows active reminders |
| `Cancel reminder #1` | Cancels a specific reminder |

---

### 📝 10. Chat Summarization
Summarizes your conversation history using AI.

| Example Prompt | What It Does |
|---|---|
| `Summarize` | Summarizes your chat history |
| `Chat summary` | Same as above |
| `TLDR` | Quick recap of conversation |
| `What did we talk about?` | Conversation recap |

---

### 👁️ 11. Image Analysis (Gemini Vision)
Send an image to the bot for OCR, description, or meme interpretation.

| Example Prompt | What It Does |
|---|---|
| *(send an image)* | Auto-analyzes the image |
| *(send image with caption)* `What does this say?` | OCR / text extraction |
| *(send image)* `Explain this meme` | Meme interpretation |
| *(send screenshot)* `Read this` | Screenshot text extraction |

---

### 🌐 12. Translation (Gemini AI)
Translates text between languages.

| Example Prompt | What It Does |
|---|---|
| `Translate "hello" to Hindi` | English → Hindi |
| `Translate to Spanish: good morning` | Any language translation |
| `What does "merci" mean?` | Word meaning/translation |

---

### 🔗 13. Link Previews
Send a URL and get a summary/preview of the page content.

| Example Prompt | What It Does |
|---|---|
| `https://example.com/article` | Previews the link content |
| *(paste any URL)* | Auto-detects and previews |

---

### 💰 14. Finance & Crypto (CoinGecko)
Check cryptocurrency and stock prices.

| Example Prompt | What It Does |
|---|---|
| `Bitcoin price` | BTC current price |
| `ETH price` | Ethereum price |
| `Crypto market` | Market overview |

---

### 🎮 15. Mini Games
Play text-based games in chat.

| Example Prompt | What It Does |
|---|---|
| `Play a game` | Lists available games |
| `Let's play trivia` | Starts trivia game |
| `Play word game` | Word-based game |

---

### 🎤 16. Voice Notes (TTS)
Bot can reply as a voice note instead of text.

| Example Prompt | What It Does |
|---|---|
| `Say this in voice` | Replies with voice note |
| `Voice reply` | TTS response |

---

### 🕒 17. Auto-Reply Engine
Automatic replies when you're busy/away.

| Owner Command | What It Does |
|---|---|
| `#autoreply on` | Enable auto-replies |
| `#autoreply off` | Disable auto-replies |
| `#autoreply busy` | Set busy mode |

---

### 📈 18. Analytics Dashboard
Web-based dashboard showing bot usage stats.

| How to Access | What It Shows |
|---|---|
| `http://localhost:3000/dashboard` | Usage stats, brain routing, response times |

---

### 🤖 19. @Bot Mention (Groups)
Trigger the bot in group chats by mentioning it.

| Example | What It Does |
|---|---|
| `@bot what's the weather?` | Triggers bot in group |
| `@Bot tell a joke` | Case-insensitive trigger |
| `@bot` *(reply to a message)* | Analyzes replied message |

---

### 🛡️ 20. Owner Commands

| Command | What It Does |
|---|---|
| `#status` | Bot status overview |
| `#analytics` | Usage analytics |
| `#ab report` | A/B testing report |

---

## 📱 How to Use

1. **DM the bot** — Just send any message, no prefix needed
2. **In groups** — Use `@bot` or `@Bot` before your message
3. **Send images** — Bot auto-analyzes images sent to it
4. **Reply to messages** — Bot understands context from quoted messages

## 🔧 Setup

```bash
# Install dependencies
npm install

# Set up .env file
GEMINI_API_KEY=your_key_here

# Run the bot
node bot.js
```

---

*Built with ❤️ by Manthan*
