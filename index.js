// SKYBOT Multi-Server Bot + Web Panel
const { execSync } = require("child_process");
const mineflayer = (() => {
  try { return require("mineflayer"); }
  catch (e) {
    console.log("Installing mineflayer...");
    execSync("npm install mineflayer", { stdio: "inherit" });
    return require("mineflayer");
  }
})();

const activeBots = [];

function launchBot(host, port, botId = 0) {
  const botName = `SKYBOT_${botId}_${Math.floor(1000 + Math.random() * 9000)}`;
  console.log(`\n🚀 Launching bot ${botName} on ${host}:${port}`);

  const bot = mineflayer.createBot({ host, port, username: botName });
  activeBots.push(bot);

  bot.on("login", () => console.log(`✅ [${botName}] Logged in.`));

  bot.on("spawn", () => {
    console.log(`🎮 [${botName}] Spawned.`);
    startMovement(bot);
  });

  bot.on("end", () => {
    console.log(`🔁 [${botName}] Disconnected. Rejoining in 1s...`);
    setTimeout(() => launchBot(host, port, botId), 1000);
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

// === Simple Web Panel ===
const http = require("http");
const fs = require("fs");
const PORT = process.env.PORT || 3000;

const html = `<!DOCTYPE html>
<html>
<head>
  <title>SKYBOT Panel</title>
  <style>
    body { background: #111; color: white; font-family: sans-serif; text-align: center; padding: 40px; }
    input, button { padding: 8px; margin: 5px; border-radius: 5px; }
  </style>
</head>
<body>
  <h1>🚀 SKYBOT Launcher</h1>
  ${Array.from({ length: 5 }).map((_, i) => `
    <form method="POST">
      <input name="ip${i}" placeholder="IP ${i+1}" required>
      <input name="port${i}" placeholder="Port ${i+1}" required>
      <button type="submit" name="botIndex" value="${i}">Send Bot ${i+1}</button>
    </form>
  `).join('')}
</body>
</html>`;

http.createServer((req, res) => {
  if (req.method === "GET") {
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
      if (ip && port) launchBot(ip, port, index);
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(`✅ Bot ${index + 1} launched!`);
    });
  }
}).listen(PORT, () => {
  console.log(`🌐 Web Panel + HTTP Server running on port ${PORT}`);
});
