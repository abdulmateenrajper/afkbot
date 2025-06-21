const fs = require("fs");
const http = require("http");
const { execSync } = require("child_process");

const PORT = process.env.PORT || 3000;
const BOT_LIMIT = 5;
const USER_LIMIT = 5;
const DATA_FILE = "button_data.json";

// Auto-install mineflayer
const mineflayer = (() => {
  try { return require("mineflayer"); }
  catch (e) {
    console.log("Installing mineflayer...");
    execSync("npm install mineflayer", { stdio: "inherit" });
    return require("mineflayer");
  }
})();

let data = {
  usedButtons: Array(BOT_LIMIT).fill(false),
  botDetails: Array(BOT_LIMIT).fill(null),
  users: {} // username: { password }
};
let activeBots = Array(BOT_LIMIT).fill(null);
let botStatus = Array(BOT_LIMIT).fill("off");
let userLogs = {}; // { username: [log lines] }

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE));
  } catch (e) {
    console.log("⚠️ Failed to load state, using default");
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function logToUser(user, msg) {
  if (!userLogs[user]) userLogs[user] = [];
  const now = new Date().toLocaleTimeString();
  userLogs[user].push(`[${now}] ${msg}`);
  if (userLogs[user].length > 50) userLogs[user].shift();
}

function parseBody(req, callback) {
  let body = "";
  req.on("data", chunk => body += chunk);
  req.on("end", () => callback(new URLSearchParams(body)));
}

function launchBot(ipPort, botId) {
  const [host, port] = ipPort.split(":");
  const username = data.botDetails[botId]?.owner;
  const botName = `SKYBOT_${botId}_${Math.floor(1000 + Math.random() * 9000)}`;
  const bot = mineflayer.createBot({ host, port: parseInt(port || 25565), username: botName });

  activeBots[botId] = bot;

  logToUser(username, `🚀 Launching bot ${botName} on ${host}:${port}`);

  bot.on("login", () => {
    botStatus[botId] = "on";
    logToUser(username, `✅ [${botName}] Logged in`);
  });

  bot.on("spawn", () => logToUser(username, `🎮 [${botName}] Spawned`));

  bot.on("end", () => {
    botStatus[botId] = "off";
    logToUser(username, `🔁 [${botName}] Disconnected, rejoining in 1s...`);
    setTimeout(() => launchBot(ipPort, botId), 1000);
  });

  bot.on("kicked", reason => logToUser(username, `⛔ [${botName}] Kicked: ${reason}`));

  bot.on("error", err => logToUser(username, `❌ [${botName}] ${err.message}`));
}

const server = http.createServer((req, res) => {
  const cookies = req.headers.cookie || "";
  const username = cookies.includes("user=") ? decodeURIComponent(cookies.split("user=")[1].split(";")[0]) : null;

  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(renderHTML(username));
  }

  if (req.method === "GET" && req.url === "/logs") {
    if (!username || !data.users[username]) return res.end("❌ Not logged in");
    return res.end((userLogs[username] || []).join("\n"));
  }

  if (req.method === "POST" && req.url === "/action") {
    parseBody(req, params => {
      const action = params.get("action");
      const index = parseInt(params.get("index"));
      const ip = params.get("ip");
      if (!username || !(username in data.users)) return res.end("🔐 Not logged in");

      if (action === "launch" && !data.usedButtons[index] && ip.includes(":")) {
        data.usedButtons[index] = true;
        data.botDetails[index] = { ip, owner: username };
        saveData();
        launchBot(ip, index);
        return res.end("✅ Bot launched");
      }

      if (action === "cancel" && data.botDetails[index]?.owner === username) {
        if (activeBots[index]) activeBots[index].quit();
        data.usedButtons[index] = false;
        data.botDetails[index] = null;
        botStatus[index] = "off";
        activeBots[index] = null;
        saveData();
        return res.end("🛑 Bot cancelled");
      }

      if (action === "edit" && data.botDetails[index]?.owner === username && ip.includes(":")) {
        if (activeBots[index]) activeBots[index].quit();
        data.botDetails[index].ip = ip;
        saveData();
        launchBot(ip, index);
        return res.end("✏️ Bot updated");
      }

      res.end("❌ Invalid action or not allowed");
    });
  }

  if (req.method === "POST" && req.url === "/login") {
    parseBody(req, params => {
      const user = params.get("user");
      const pass = params.get("pass");
      if (data.users[user] && data.users[user].password === pass) {
        res.writeHead(200, { "Set-Cookie": `user=${encodeURIComponent(user)}; HttpOnly` });
        return res.end("✅ Logged in");
      }
      res.end("❌ Invalid credentials");
    });
  }

  if (req.method === "POST" && req.url === "/register") {
    parseBody(req, params => {
      const user = params.get("user");
      const pass = params.get("pass");
      if (Object.keys(data.users).length >= USER_LIMIT) return res.end("❌ Max users");
      if (data.users[user]) return res.end("❌ User exists");
      data.users[user] = { password: pass };
      saveData();
      res.writeHead(200, { "Set-Cookie": `user=${encodeURIComponent(user)}; HttpOnly` });
      res.end("✅ Registered");
    });
  }

  if (req.url === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ botStatus, botDetails: data.botDetails }));
  }
});

function renderHTML(username) {
  const loggedIn = !!username;
  const form = !loggedIn ? `
    <h2>Register or Login</h2>
    <input id="user" placeholder="Username"><br>
    <input id="pass" placeholder="Password" type="password"><br>
    <button onclick="auth('register')">Register</button>
    <button onclick="auth('login')">Login</button>
    <p id="msg"></p>
  ` : `
    <h2>Hello ${username}</h2>
    ${Array.from({ length: BOT_LIMIT }).map((_, i) => {
      const used = data.usedButtons[i];
      const detail = data.botDetails[i];
      const editable = detail?.owner === username;
      return `
        <div style="margin:10px;border:1px solid #444;padding:10px;border-radius:5px">
          <input id="ip${i}" placeholder="IP:Port" value="${detail?.ip || ''}" ${used && !editable ? 'disabled' : ''}>
          ${!used ? `<button onclick="send(${i}, 'launch')">Send</button>` : editable ? `
            <button onclick="send(${i}, 'edit')">Edit</button>
            <button onclick="send(${i}, 'cancel')">Cancel</button>
          ` : `<button disabled>In Use</button>`}
          <span id="stat${i}">[${botStatus[i]}]</span>
        </div>
      `;
    }).join("")}
    <h3>📋 Your Bot Logs</h3>
    <textarea id="logs" rows="10" cols="60" readonly style="background:#000;color:#0f0"></textarea>
  `;
  return `
    <!DOCTYPE html><html><head><title>SKYBOT Panel</title></head>
    <body style="background:#111;color:white;text-align:center;padding:20px;font-family:sans-serif">
      <h1>🚀 SKYBOT HOST</h1>
      ${form}
      <script>
        function auth(type) {
          const user = document.getElementById('user').value;
          const pass = document.getElementById('pass').value;
          fetch("/" + type, {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: "user=" + encodeURIComponent(user) + "&pass=" + encodeURIComponent(pass)
          }).then(res => res.text()).then(txt => {
            document.getElementById("msg").textContent = txt;
            if (txt.includes("✅")) location.reload();
          });
        }

        function send(i, act) {
          const ip = document.getElementById("ip" + i).value;
          fetch("/action", {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: "index=" + i + "&action=" + act + "&ip=" + encodeURIComponent(ip)
          }).then(res => res.text()).then(alert);
        }

        setInterval(() => {
          fetch("/status").then(r => r.json()).then(d => {
            d.botStatus.forEach((s, i) => {
              const el = document.getElementById("stat" + i);
              if (el) el.textContent = "[" + s + "]";
            });
          });
          fetch("/logs").then(r => r.text()).then(txt => {
            const logEl = document.getElementById("logs");
            if (logEl) logEl.value = txt;
          });
        }, 4000);
      </script>
    </body></html>
  `;
}

server.listen(PORT, () => {
  console.log(`🌐 SKYBOT Panel running at http://localhost:${PORT}`);
});
