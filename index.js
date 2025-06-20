const { execSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const PORT = process.env.PORT || 3000;

// Auto-install mineflayer if missing
const mineflayer = (() => {
  try { return require("mineflayer"); }
  catch (e) {
    console.log("Installing mineflayer...");
    execSync("npm install mineflayer", { stdio: "inherit" });
    return require("mineflayer");
  }
})();

// Load saved button states
const DATA_FILE = "button_data.json";
let usedButtons = Array(10).fill(false);
try {
  if (fs.existsSync(DATA_FILE)) {
    usedButtons = JSON.parse(fs.readFileSync(DATA_FILE));
  }
} catch (err) {
  console.error("❌ Failed to load button state:", err);
}

// Save button states
function saveButtonData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(usedButtons));
}

// Store active bots
const activeBots = [];

// Launch a bot
function launchBot(host, port, botId = 0, onSuccess = () => {}) {
  const botName = `SKYBOT_${botId}_${Math.floor(1000 + Math.random() * 9000)}`;
  console.log(`🚀 Launching bot ${botName} on ${host}:${port}`);

  const bot = mineflayer.createBot({ host, port, username: botName });
  activeBots.push(bot);

  bot.once("login", () => {
    console.log(`✅ [${botName}] Logged in.`);
    onSuccess();
  });

  bot.on("spawn", () => {
    console.log(`🎮 [${botName}] Spawned.`);
    startMovement(bot);
  });

  bot.on("end", () => {
    console.log(`🔁 [${botName}] Disconnected. Rejoining in 1s...`);
    setTimeout(() => launchBot(host, port, botId, onSuccess), 1000);
  });

  bot.on("kicked", reason => console.log(`⛔ [${botName}] Kicked: ${reason}`));
  bot.on("error", err => console.log(`❌ [${botName}] Error: ${err.message}`));
}

// Simulate movement
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

// Web panel server
http.createServer((req, res) => {
  if (req.method === "GET") {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>SKYBOT Panel</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background: #111; color: white; font-family: sans-serif; padding: 20px; text-align: center; }
    form { margin: 10px auto; max-width: 300px; }
    input, button {
      width: 90%; padding: 10px; margin: 5px 0;
      border: none; border-radius: 5px;
    }
    button:disabled { background: gray; color: #222; cursor: not-allowed; }
    @media (min-width: 600px) {
      form { display: inline-block; margin: 15px; }
    }
  </style>
</head>
<body>
  <h1>🚀 SKYBOT Launcher</h1>
  ${Array.from({ length: 10 }).map((_, i) => `
    <form method="POST">
      <input name="ip${i}" placeholder="IP ${i + 1}" required>
      <input name="port${i}" placeholder="Port ${i + 1}" required>
      <button type="submit" name="botIndex" value="${i}" ${usedButtons[i] ? "disabled" : ""}>
        ${usedButtons[i] ? "Used" : `Send Bot ${i + 1}`}
      </button>
    </form>
  `).join('')}
</body>
</html>`;
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  } else if (req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      const params = new URLSearchParams(body);
      const index = parseInt(params.get("botIndex"));
      const ip = params.get(`ip${index}`);
      const port = parseInt(params.get(`port${index}`));

      console.log(`🌐 User requested bot ${index} to ${ip}:${port}`);

      if (ip && port && !usedButtons[index]) {
        launchBot(ip, port, index, () => {
          usedButtons[index] = true;
          saveButtonData();
        });
      }

      res.writeHead(302, { Location: "/" });
      res.end();
    });
  }
}).listen(PORT, () => {
  console.log(`🌐 Web Panel running on port ${PORT}`);
});
