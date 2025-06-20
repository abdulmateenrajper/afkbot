const { execSync } = require("child_process");

// Auto-install mineflayer
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

let botNames = ["SKYBOT_One", "SKYBOT_Two"];
let attemptCount = { "SKYBOT_One": 0, "SKYBOT_Two": 0 };
const MAX_ATTEMPTS = 5;

function launchBot(index) {
  const name = botNames[index];
  const otherIndex = 1 - index;

  if (attemptCount[name] >= MAX_ATTEMPTS) {
    console.log(`🚫 [${name}] exceeded ${MAX_ATTEMPTS} failed attempts. Replacing...`);
    botNames[index] = generateRandomName();
    attemptCount[botNames[index]] = 0;
    return launchBot(index); // Retry with new name
  }

  console.log(`🚀 [${name}] Launching attempt ${attemptCount[name] + 1}`);
  attemptCount[name] += 1;

  const bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: name,
  });

  bot.on("login", () => {
    console.log(`✅ [${name}] Logged in`);
    attemptCount[name] = 0;
  });

  bot.on("spawn", () => {
    console.log(`🎮 [${name}] Spawned`);
    startMovement(bot);
  });

  bot.on("end", () => {
    console.log(`🔁 [${name}] Disconnected. Retrying in 1s...`);
    setTimeout(() => launchBot(otherIndex), 1000);
  });

  bot.on("kicked", (reason) => {
    console.log(`⛔ [${name}] Kicked: ${reason}`);
  });

  bot.on("error", (err) => {
    console.log(`❌ [${name}] Error: ${err.message}`);
  });
}

function generateRandomName() {
  return "SKYBOT_" + Math.floor(1000 + Math.random() * 9000);
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

// Start first bot
launchBot(0);
