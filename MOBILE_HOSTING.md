# 📱 Hosting Manthan AI on Mobile (Termux)

Complete guide to run the bot 24/7 on your Android phone.

## Prerequisites
- **Android phone** (ARM64 or ARM)
- **Termux** from F-Droid (NOT Play Store — Play Store version is outdated)
  - Download: https://f-droid.org/en/packages/com.termux/

## Step-by-step Setup

### 1. Install Termux & Basic Tools
```bash
# Update packages
pkg update && pkg upgrade -y

# Install Node.js & Git
pkg install nodejs git -y

# Verify
node --version   # Should show v18+ or v20+
npm --version
```

### 2. Clone the Bot
```bash
# Navigate to home
cd ~

# Clone the repo (replace with your repo URL)
git clone https://github.com/YOUR_USERNAME/UltimateBot.git
cd UltimateBot
```

### 3. Install Dependencies
```bash
# This works WITHOUT any native compilation!
# sql.js is pure JavaScript — no C++ compiler needed
npm install
```

### 4. Configure
```bash
# Copy & edit .env
cp .env.example .env

# Edit with nano (or vi)
nano .env
# Add your GEMINI_API_KEY=your_key_here
# Save: Ctrl+O, Enter, Ctrl+X
```

### 5. Start the Bot
```bash
node bot.js
```
A QR code will appear in your terminal. **Scan it with WhatsApp** linked devices.

### 6. How to Update the Bot
If you've pushed new code to GitHub and want to update the bot in Termux:
```bash
# 1. Stop the bot (Ctrl+C)

# 2. Get latest code
git pull origin main

# 3. Refresh dependencies
npm install

# 4. Restart
node bot.js
```

### 7. Keep Running in Background

#### Option A: Using `termux-wake-lock` (recommended)
```bash
# Prevent Android from killing Termux
termux-wake-lock

# Start bot
node bot.js
```

#### Option B: Using `nohup` + `screen`
```bash
# Install screen
pkg install screen -y

# Start a named screen session
screen -S manthan

# Start the bot
node bot.js

# Detach: Press Ctrl+A then D
# Reattach later:
screen -r manthan
```

#### Option C: Using PM2 (process manager)
```bash
# Install PM2
npm install -g pm2

# Start bot
pm2 start bot.js --name manthan-ai

# Check status
pm2 status

# View logs
pm2 logs manthan-ai

# Auto-restart on crash
pm2 startup
pm2 save
```

## Battery & Performance Tips

### Disable Battery Optimization for Termux
1. Go to **Settings → Apps → Termux**
2. **Battery → Unrestricted** (or disable battery optimization)
3. This prevents Android from killing Termux in the background

### Acquire Wake Lock
```bash
termux-wake-lock
```
This keeps the CPU running even when screen is off.

### Termux Notification
Keep the Termux notification visible in your notification tray — this helps Android keep the process alive.

### Memory Usage
The bot uses approximately:
- **~40-60 MB RAM** at idle
- **~80-120 MB RAM** under load (during API calls)
- No native modules — everything is pure JavaScript

## Troubleshooting

### "EACCES: permission denied"
```bash
chmod -R 755 ~/UltimateBot
```

### "Cannot find module 'sql.js'"
```bash
cd ~/UltimateBot
npm install
```

### QR Code Not Showing in Terminal
Open `http://localhost:3000` in your phone browser to see the QR code visually.

### Bot Stops When Phone Sleeps
- Enable wake lock: `termux-wake-lock`
- Disable battery optimization for Termux
- Use `screen` or PM2

### Node.js Version Too Old
```bash
pkg install nodejs-lts
```

## Port Access
The bot runs a web server on port 3000 by default.
- Access from phone browser: `http://localhost:3000`
- Access from same WiFi: `http://PHONE_IP:3000`

To find your phone's IP:
```bash
ifconfig | grep inet
```

## Storage Location
- Auth data: `~/UltimateBot/auth_info/`
- Database: `~/UltimateBot/data/memory.db`
- Voice temp: `~/UltimateBot/data/voice-temp/`

## Why This Works on Mobile
- ✅ **sql.js** — Pure JavaScript SQLite (no native compilation)
- ✅ **No ffmpeg dependency** — Voice uses Google TTS directly
- ✅ **No Python/C++ needed** — Everything runs in Node.js
- ✅ **Low memory footprint** — ~60MB idle
- ✅ **Works offline** — Knowledge Brain + Social Brain work without internet
