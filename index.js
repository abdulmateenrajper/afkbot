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
let usedButtons = Array(5).fill(false);
let botDetails = Array(5).fill(null);

// Try to load saved data
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

// Save state
function saveButtonData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ usedButtons, botDetails }, null, 2));
}

const activeBots = [];

function isValidHost(ip) {
  return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(ip);
}

function launchBot(host, port, botId = 0) {
  const botName = `SKYBOT_${botId}_${Math.floor(1000 + Math.random() * 9000)}`;
  console.log(`🚀 Launching bot ${botName} on ${host}:${port}`);

  let reconnectTries = 0;

  function connect() {
    const bot = mineflayer.createBot({ host, port, username: botName });

    bot.on("login", () => {
      console.log(`✅ [${botName}] Logged in.`);
      reconnectTries = 0;
    });

    bot.on("spawn", () => {
      console.log(`🎮 [${botName}] Spawned.`);
      startMovement(bot);
    });

    bot.on("end", () => {
      console.log(`🔁 [${botName}] Disconnected. Rejoining in 3s...`);
      setTimeout(connect, 3000);
    });

    bot.on("kicked", reason => {
      console.log(`⛔ [${botName}] Kicked: ${reason}`);
    });

    bot.on("error", err => {
      console.log(`❌ [${botName}] Error: ${err.message}`);
      reconnectTries++;
      if (reconnectTries < 5) {
        setTimeout(connect, 3000);
      } else {
        console.log(`❌ [${botName}] Failed after 5 retries.`);
      }
    });
  }

  connect();
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

// ✅ Web server with confirmation page
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
  ${Array.from({ length: 5 }).map((_, i) => `
    <form method="POST">
      <input name="ip${i}" placeholder="IP ${i + 1}" required>
      <input name="port${i}" placeholder="Port ${i + 1}" required>
      <button type="submit" name="botIndex" value="${i}" ${usedButtons[i] ? 'disabled' : ''}>
        ${usedButtons[i] ? 'Used (' + (botDetails[i]?.name || '?') + ')' : `Send Bot ${i + 1}`}
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

      console.log(`🌐 User input: Bot ${index} to ${ip}:${port}`);

      if (!usedButtons[index] && ip && port && isValidHost(ip)) {
        const botName = `SKYBOT_${index}_${Math.floor(1000 + Math.random() * 9000)}`;
        usedButtons[index] = true;
        botDetails[index] = { ip, port, name: botName };
        saveButtonData();

        launchBot(ip, port, index);

        // Confirmation page
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<!DOCTYPE html>
<html>
  <head><title>Bot Launched</title></head>
  <body style="background:#111;color:#0f0;font-family:sans-serif;text-align:center;padding-top:20vh;">
    <h1>🚀 Bot Launched!</h1>
    <p>Bot <strong>${botName}</strong> is connecting to:</p>
    <p><code>${ip}:${port}</code></p>
    <a href="/" style="color:cyan;text-decoration:underline;">← Go back</a>
  </body>
</html>`);
      } else {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h2 style="color:red;text-align:center;padding-top:20vh;">❌ Invalid IP or Already Used</h2><p style="text-align:center;"><a href="/">Back</a></p>`);
      }
    });
  }
}).listen(PORT, () => {
  console.log(`🌐 SKYBOT Panel running on port ${PORT}`);
});
