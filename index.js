const { execSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const PORT = process.env.PORT || 3000;

const mineflayer = (() => {
  try { return require("mineflayer"); }
  catch (e) {
    console.log("Installing mineflayer...");
    execSync("npm install mineflayer", { stdio: "inherit" });
    return require("mineflayer");
  }
})();

const BOT_LIMIT = 5;
const DATA_FILE = "button_data.json";
let usedButtons = Array(BOT_LIMIT).fill(false);
let botDetails = Array(BOT_LIMIT).fill(null);
let activeBots = Array(BOT_LIMIT).fill(null);
let botStatus = Array(BOT_LIMIT).fill("🔴");

const IP_BLACKLIST = ["127.0.0.1", "localhost", "0.0.0.0"];

function isIpPortFormat(input) {
  return /^[a-zA-Z0-9.-]+:\d+$/.test(input);
}

function isBlacklisted(ipPort) {
  const host = ipPort.split(":")[0];
  return IP_BLACKLIST.includes(host);
}

try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    if (raw.trim()) {
      const data = JSON.parse(raw);
      usedButtons = data.usedButtons || usedButtons;
      botDetails = data.botDetails || botDetails;
    }
  }
} catch (err) {
  console.error("❌ Failed to load saved state:", err);
}

function saveButtonData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ usedButtons, botDetails }, null, 2));
}

function parseHost(input) {
  const parts = input.split(":");
  const host = parts[0];
  const port = parseInt(parts[1]);
  return { host, port };
}

function launchBot(ipPort, botId = 0, attempt = 0, totalFailures = 0) {
  const { host, port } = parseHost(ipPort);
  const botName = `SKYBOT_${botId}_${Math.floor(1000 + Math.random() * 9000)}`;
  console.log(`🚀 Launching bot ${botName} on ${host}:${port} (try ${attempt + 1}, fails: ${totalFailures})`);

  const bot = mineflayer.createBot({ host, port, username: botName });
  activeBots[botId] = bot;

  bot.on("login", () => {
    console.log(`✅ [${botName}] Logged in.`);
    botStatus[botId] = "🟢";
  });

  bot.on("spawn", () => startMovement(bot));

  bot.on("end", () => {
    botStatus[botId] = "🔴";
    setTimeout(() => {
      if (totalFailures >= 10) {
        usedButtons[botId] = false;
        botDetails[botId] = null;
        activeBots[botId] = null;
        saveButtonData();
        console.log(`❌ [${botName}] Gave up after 10 failures.`);
      } else if (attempt >= 5) {
        launchBot(ipPort, botId, 0, totalFailures + 1);
      } else {
        launchBot(ipPort, botId, attempt + 1, totalFailures + 1);
      }
    }, 1000);
  });

  bot.on("kicked", reason => console.log(`⛔ [${botName}] Kicked: ${reason}`));
  bot.on("error", err => console.log(`❌ [${botName}] Error: ${err.message}`));
}

function startMovement(bot) {
  const moves = ["forward", "back", "left", "right"];
  let moving = false;
  setInterval(() => {
    if (!bot || !bot.entity) return;
    const dir = moves[Math.floor(Math.random() * moves.length)];
    const dur = Math.floor(Math.random() * 3000) + 1000;
    if (moving) {
      moves.forEach(m => bot.setControlState(m, false));
      bot.setControlState("jump", false);
      moving = false;
    } else {
      bot.setControlState(dir, true);
      if (Math.random() > 0.7) bot.setControlState("jump", true);
      moving = true;
      setTimeout(() => {
        bot.setControlState(dir, false);
        bot.setControlState("jump", false);
        moving = false;
      }, dur);
    }
    const yaw = Math.random() * 2 * Math.PI;
    bot.look(yaw, 0, true);
  }, 5000);
}

http.createServer((req, res) => {
  if (req.method === "GET") {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>SKYBOT Java Edition Panel</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="5"> <!-- Auto-refresh -->
  <style>
    body { background: #111; color: white; font-family: sans-serif; padding: 20px; text-align: center; }
    form { margin: 10px auto; max-width: 300px; background: #222; padding: 15px; border-radius: 8px; }
    input, button {
      width: 90%; padding: 10px; margin: 5px 0;
      border: none; border-radius: 5px;
    }
    button:disabled { background: gray; color: #222; cursor: not-allowed; }
    .btn { background: #333; color: white; cursor: pointer; }
    .row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  </style>
</head>
<body>
  <h1>🚀 SKYBOT Java Edition Launcher</h1>
  ${Array.from({ length: BOT_LIMIT }).map((_, i) => `
    <form method="POST">
      <p>Status: ${botStatus[i]} ${botDetails[i]?.ip || '—'}</p>
      <input name="ip${i}" placeholder="IP:Port for Bot ${i + 1}" value="${botDetails[i]?.ip || ''}" ${usedButtons[i] ? 'readonly' : ''}>
      <div class="row">
        ${!usedButtons[i] ? `
          <button class="btn" type="submit" name="action" value="launch_${i}">Send Bot</button>
        ` : `
          <button class="btn" type="submit" name="action" value="edit_${i}">Edit</button>
          <button class="btn" type="submit" name="action" value="cancel_${i}">Cancel</button>
        `}
      </div>
    </form>
  `).join('')}
</body>
</html>`;
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  }

  if (req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      const params = new URLSearchParams(body);
      const action = params.get("action");
      const [type, idx] = action.split("_");
      const index = parseInt(idx);
      const ip = params.get(`ip${index}`);

      if (!isIpPortFormat(ip) || isBlacklisted(ip)) {
        console.log(`❌ Rejected unsafe or invalid IP: ${ip}`);
        res.writeHead(302, { Location: "/" });
        return res.end();
      }

      if (type === "launch" && !usedButtons[index]) {
        usedButtons[index] = true;
        botDetails[index] = { ip };
        saveButtonData();
        launchBot(ip, index);
      }

      if (type === "edit") {
        console.log(`✏️ Editing bot ${index} to ${ip}`);
        if (activeBots[index]) activeBots[index].quit();
        botDetails[index] = { ip };
        saveButtonData();
        launchBot(ip, index);
      }

      if (type === "cancel") {
        console.log(`🛑 Cancelled bot ${index}`);
        if (activeBots[index]) activeBots[index].quit();
        usedButtons[index] = false;
        botDetails[index] = null;
        botStatus[index] = "🔴";
        activeBots[index] = null;
        saveButtonData();
      }

      res.writeHead(302, { Location: "/" });
      res.end();
    });
  }
}).listen(PORT, () => {
  console.log(`🌐 SKYBOT Panel running at http://localhost:${PORT}`);
});
