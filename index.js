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
let botStatus = Array(BOT_LIMIT).fill("off");

const IP_BLACKLIST = ["127.0.0.1", "localhost", "0.0.0.0"];

function isIpPortFormat(input) {
  return /^[a-zA-Z0-9.-]+:\d+$/.test(input);
}

function isBlacklisted(ipPort) {
  const host = ipPort.split(":")[0];
  return IP_BLACKLIST.includes(host);
}

function isDuplicate(ipPort, index) {
  return botDetails.some((b, i) => b?.ip === ipPort && i !== index);
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
  return { host: parts[0], port: parseInt(parts[1]) };
}

function launchBot(ipPort, botId = 0, attempt = 0, totalFailures = 0) {
  const { host, port } = parseHost(ipPort);
  const botName = `SKYBOT_${botId}_${Math.floor(1000 + Math.random() * 9000)}`;
  console.log(`🚀 Launching bot ${botName} on ${host}:${port} (try ${attempt + 1}, fails: ${totalFailures})`);

  const bot = mineflayer.createBot({ host, port, username: botName });
  activeBots[botId] = bot;

  bot.on("login", () => {
    console.log(`✅ [${botName}] Logged in.`);
    botStatus[botId] = "on";
  });

  bot.on("spawn", () => startMovement(bot));

  bot.on("end", () => {
    botStatus[botId] = "off";
    setTimeout(() => {
      if (totalFailures >= 10) {
        usedButtons[botId] = false;
        botDetails[botId] = null;
        activeBots[botId] = null;
        saveButtonData();
        console.log(`❌ [${botName}] Gave up after 10 failures. Button reset.`);
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
  if (req.method === "GET" && req.url === "/") {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>SKYBOT Panel</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
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
    img.status { width: 16px; vertical-align: middle; }
  </style>
  <script>
    async function refreshStatus() {
      const res = await fetch("/status");
      const data = await res.json();
      data.status.forEach((stat, i) => {
        document.getElementById("status" + i).src = stat === "on" 
          ? "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Yes_Check_Circle.svg/32px-Yes_Check_Circle.svg.png" 
          : "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Close_icon_red.svg/32px-Close_icon_red.svg.png";
        document.getElementById("ip" + i).textContent = data.details[i]?.ip || '—';
      });
    }
    setInterval(refreshStatus, 4000);
    window.onload = refreshStatus;
  </script>
</head>
<body>
  <h1>🚀 SKYBOT Java Edition Panel</h1>
  ${Array.from({ length: BOT_LIMIT }).map((_, i) => `
    <form method="POST">
      <p><img id="status${i}" class="status" src="${botStatus[i] === 'on'
        ? 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Yes_Check_Circle.svg/32px-Yes_Check_Circle.svg.png'
        : 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Close_icon_red.svg/32px-Close_icon_red.svg.png'}">
        <span id="ip${i}">${botDetails[i]?.ip || '—'}</span>
      </p>
      <input name="ip${i}" placeholder="IP:Port" value="${botDetails[i]?.ip || ''}" ${usedButtons[i] ? 'readonly' : ''}>
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

  else if (req.url === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: botStatus, details: botDetails }));
  }

  else if (req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      const params = new URLSearchParams(body);
      const action = params.get("action");
      const [type, idx] = action.split("_");
      const index = parseInt(idx);
      const ip = params.get(`ip${index}`);

      if (!isIpPortFormat(ip) || isBlacklisted(ip) || isDuplicate(ip, index)) {
        console.log(`❌ Rejected IP: ${ip}`);
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
        if (activeBots[index]) activeBots[index].quit();
        botDetails[index] = { ip };
        saveButtonData();
        launchBot(ip, index);
      }

      if (type === "cancel") {
        if (activeBots[index]) activeBots[index].quit();
        usedButtons[index] = false;
        botDetails[index] = null;
        botStatus[index] = "off";
        activeBots[index] = null;
        saveButtonData();
      }

      res.writeHead(302, { Location: "/" });
      res.end();
    });
  }
}).listen(PORT, () => {
  console.log(`🌐 SKYBOT running on http://localhost:${PORT}`);
});
