# SKYBOT Multi-Server Bot + Web Panel

This project uses [Mineflayer](https://github.com/PrismarineJS/mineflayer) to launch up to 5 Minecraft bots — each connecting to a different server — with an integrated web panel for easy control.

---

## 🚀 Features

- 🖥️ Web panel with 5 individual IP/Port input forms
- 🎮 Bots auto-join and simulate AFK movement
- 🔁 Auto-reconnect on kick/disconnect
- 🔀 Random bot usernames (`SKYBOT_XXXX`)
- 🌐 HTTP server keeps it alive on hosts like **Render** or **Replit**

---

## 🔧 Requirements

- Node.js (v16 or higher)
- Minecraft servers that allow cracked clients (if not using a Mojang/Microsoft account)

---

## 🛠 Setup

1. **Install dependencies** (Mineflayer auto-installs on first run)

2. Create a file named `index.js` and paste the full code from this repo.

3. Run the server:
```bash
node index.js
