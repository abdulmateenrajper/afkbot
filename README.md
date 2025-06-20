# SKYBOT Multi-Bot Launcher

SKYBOT is a lightweight, browser-controlled Node.js app that lets you deploy up to **10 Minecraft bots** on different IP/port combinations. It uses [Mineflayer](https://github.com/PrismarineJS/mineflayer) for bot creation and simulates AFK activity.

## 🚀 Features
- 10 bot slots
- Each bot controlled via a responsive web panel
- Reconnection if kicked or disconnected
- Random usernames (e.g. `SKYBOT_0_8392`)
- Persistent launch button states (resets survive restarts)
- Mobile-friendly interface

## 🛠️ Setup

1. Install Node.js (v16 or higher).
2. Place the `index.js` in a folder and run:
```bash
node index.js
```
3. Open `http://localhost:3000` or your hosted Render/Replit URL.

## 🌐 Web Panel
Each bot has its own form with IP and Port fields:

```
[ IP 1 ] [ PORT 1 ] [Send Bot 1]
[ IP 2 ] [ PORT 2 ] [Send Bot 2]
...
```

After a bot is launched, the button becomes disabled to prevent duplicate launches.

## 💬 Bot Behavior
- Walks randomly every 5 seconds
- Occasionally jumps
- Turns head randomly
- Rejoins automatically on disconnect

## 📁 File List
- `index.js` – Main server + bot logic
- `button_data.json` – Saves which buttons have been used (auto-created)

## ⚠️ Notice on Aternos or Other Servers
This project is strictly for educational/testing use.
If any server (including Aternos) detects unusual behavior and bans your IP/account:

> **We are not responsible. Use responsibly and at your own risk.**

## 📜 License
See [LICENSE.md](LICENSE.md)

## 📄 Terms of Use
See [TOS.md](TOS.md)
