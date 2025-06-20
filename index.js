const { execSync } = require("child_process");
const mineflayer = (() => {
  try {
    return require("mineflayer");
  } catch (e) {
    console.log("Installing mineflayer...");
    execSync("npm install mineflayer", { stdio: "inherit" });
    return require("mineflayer");
  }
})();

// === CONFIG ===
const host = "bhrata.aternos.me";
const port = 14495; // Render might block this
const username = "SKYBOT_" + Math.floor(Math.random() * 10000);

function startBot() {
  const bot = mineflayer.createBot({ host, port, username });

  bot.on("login", () => {
    console.log(`[✅ LOGIN] Logged in as ${bot.username}`);
  });

  bot.on("spawn", () => {
    console.log("[🎮 SPAWN] Bot spawned. Starting AFK movement.");
    setInterval(() => {
      const yaw = Math.random() * 2 * Math.PI;
      const pitch = 0;
      bot.look(yaw, pitch, true);
    }, 10000);
  });

  bot.on("kicked", (reason) => {
    console.log(`[⛔ KICKED] ${reason}`);
  });

  bot.on("end", () => {
    console.log("[🔁 RECONNECTING] Bot disconnected. Trying again in 5s...");
    setTimeout(startBot, 5000);
  });

  bot.on("error", (err) => {
    console.log("[❌ ERROR]", err.message);
  });
}

startBot();
