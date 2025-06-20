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

const DATA_FILE = "button_data.json";
let usedButtons = Array(10).fill(false);
let botDetails = Array(10).fill(null);
let activeBots = Array(10).fill(null);

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

function isIpPortFormat(input) {
  return /^[a-zA-Z0-9.-]+:\d+$/.test(input);
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
  console.log(`🚀 Launching bot ${botName} on ${host}:${port} (try ${attempt + 1}, total fails: ${totalFailures})`);

  const bot = mineflayer.createBot({ host, port, username: botName });
  activeBots[botId] = bot;

  bot.on("login", () => console.log(`✅ [${botName}] Logged in.`));
  bot.on("spawn", () => startMovement(bot));

  bot.on("end", () => {
    console.log(`🔁 [${botName}] Disconnected.`);
    setTimeout(() => {
      if (totalFailures >= 10) {
        console.log(`❌ [${botName}] Gave up after 10 failures.`);
        usedButtons[botId] = false;
        botDetails[botId] = null;
        activeBots[botId] = null;
        saveButtonData();
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
  ${Array.from({ length: 10 }).map((_, i) => `
    <form method="POST">
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

      if (type === "launch" && !usedButtons[index] && ip && isIpPortFormat(ip)) {
        usedButtons[index] = true;
        botDetails[index] = { ip };
        saveButtonData();
        launchBot(ip, index);
      }

      if (type === "edit" && ip && isIpPortFormat(ip)) {
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
