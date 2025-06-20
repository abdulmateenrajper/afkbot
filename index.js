const { execSync } = require("child_process");

// 📦 Auto-install mineflayer
const mineflayer = (() => {
  try { return require("mineflayer"); }
  catch (e) {
    console.log("Installing mineflayer...");
    execSync("npm install mineflayer", { stdio: "inherit" });
    return require("mineflayer");
  }
})();

// === CONFIG ===
const HOST = "bhrata.aternos.me";
const PORT = 14495;

// === Auto-launch Real Bot ===
function launchBot() {
  const botName = "SKYBOT_" + Math.floor(1000 + Math.random() * 9000);
  console.log(`🚀 Launching bot: ${botName}`);

  const bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: botName,
  });

  bot.on("login", () => {
    console.log(`✅ [${botName}] Logged in`);
  });

  bot.on("spawn", () => {
    console.log(`🎮 [${botName}] Spawned`);
    startMovement(bot);
  });

  bot.on("end", () => {
    console.log(`🔁 [${botName}] Disconnected. Rejoining in 1s...`);
    setTimeout(launchBot, 1000);
  });

  bot.on("kicked", reason => {
    console.log(`⛔ [${botName}] Kicked: ${reason}`);
  });

  bot.on("error", err => {
    console.log(`❌ [${botName}] Error: ${err.message}`);
  });
}

// === Movement Simulation (AFK)
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

// === Fake Port for Render & Hosting ===
require("http").createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("SKYBOT is online\n");
}).listen(process.env.PORT || 3000, () => {
  console.log("🌐 Fake HTTP port opened to keep host alive.");
});

// 🚀 Start Bot
launchBot();
