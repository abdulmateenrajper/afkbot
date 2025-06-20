const { execSync } = require("child_process");

const mineflayer = (() => {
  try { return require("mineflayer"); }
  catch (e) {
    console.log("Installing mineflayer...");
    execSync("npm install mineflayer", { stdio: "inherit" });
    return require("mineflayer");
  }
})();

const HOST = "bhrata.aternos.me";
const PORT = 14495;

let current = 0;

const bots = [
  { name: "SKYBOT_One", bot: null },
  { name: "SKYBOT_Two", bot: null },
];

function createBot(index) {
  const other = 1 - index;

  bots[index].bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: bots[index].name,
  });

  const bot = bots[index].bot;

  bot.on("login", () => console.log(`[✅ LOGIN] ${bots[index].name} joined.`));
  bot.on("spawn", () => {
    console.log(`[🎮 SPAWNED] ${bots[index].name}`);
    startMovement(bot);
  });

  bot.on("end", () => {
    console.log(`[🔁 DISCONNECTED] ${bots[index].name}`);
    bots[index].bot = null;
    setTimeout(() => {
      current = other;
      console.log(`[➡️ SWITCH] Launching ${bots[other].name}`);
      createBot(other);
    }, 5000);
  });

  bot.on("kicked", reason => console.log(`[⛔ KICKED] ${bots[index].name} - ${reason}`));
  bot.on("error", err => console.log(`[❌ ERROR] ${err.message}`));
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

// Start bot
createBot(0);

// Fake HTTP server for Render (optional)
require("http").createServer((req, res) => {
  res.end("SKYBOT running");
}).listen(process.env.PORT || 3000);
