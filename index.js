const fs = require("fs");
const http = require("http");
const { execSync } = require("child_process");

const PORT = process.env.PORT || 3000;
const SESSION_TIMEOUT = 15 * 60 * 1000;

const DATA_FILE = "button_data.json";
const SESSIONS = {};

const mineflayer = (() => {
  try { return require("mineflayer"); }
  catch (e) {
    execSync("npm install mineflayer", { stdio: "inherit" });
    return require("mineflayer");
  }
})();

let data = {
  usedButtons: Array(1).fill(false),
  botDetails: Array(1).fill(null),
  users: {}
};
let activeBots = Array(1).fill(null);
let botStatus = Array(1).fill("Offline");
let userLogs = {};

if (fs.existsSync(DATA_FILE)) {
  try { data = JSON.parse(fs.readFileSync(DATA_FILE)); } catch {}
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

function launchBot(ipPort, botId) {
  const [host, port] = ipPort.split(":");
  const username = data.botDetails[botId]?.owner;
  const botName = `SKYBOT_${botId}_${Math.floor(Math.random() * 9999)}`;
  const bot = mineflayer.createBot({ host, port: parseInt(port || 25565), username: botName });
  activeBots[botId] = bot;
  botStatus[botId] = "Online";

  logToUser(username, `Launching bot ${botName} on ${host}:${port}`);
  bot.on("login", () => logToUser(username, `[${botName}] Logged in`));
  bot.on("spawn", () => logToUser(username, `[${botName}] Spawned`));
  bot.on("end", () => {
    logToUser(username, `[${botName}] Disconnected`);
    botStatus[botId] = "Offline";
  });
  bot.on("kicked", r => logToUser(username, `[${botName}] Kicked: ${r}`));
  bot.on("error", err => logToUser(username, `[${botName}] Error: ${err.message}`));
}

function parseBody(req, cb) {
  let body = "";
  req.on("data", chunk => body += chunk);
  req.on("end", () => cb(new URLSearchParams(body)));
}

function validateSession(cookie) {
  if (!cookie?.includes("token=")) return null;
  const token = cookie.split("token=")[1].split(";")[0];
  const session = SESSIONS[token];
  if (!session) return null;
  if (Date.now() - session.created > SESSION_TIMEOUT) {
    delete SESSIONS[token];
    return null;
  }
  return session.username;
}

http.createServer((req, res) => {
  const username = validateSession(req.headers.cookie || "");

  if (req.method === "GET" && req.url === "/") {
    return res.end(renderHTML(username));
  }

  if (req.url === "/status") {
    return res.end(JSON.stringify({ status: botStatus, botDetails: data.botDetails }));
  }

  if (req.url === "/logs" && username) {
    return res.end((userLogs[username] || []).join("\n"));
  }

  if (req.method === "POST" && req.url === "/auth") {
    parseBody(req, p => {
      const user = p.get("user");
      const pass = p.get("pass");
      const type = p.get("type");

      if (!user || !pass) return res.end("❌ Username & Password required");

      if (type === "register") {
        if (Object.keys(data.users).length >= 5) return res.end("❌ Max users reached");
        if (data.users[user]) return res.end("❌ User already exists");
        data.users[user] = pass;
        saveData();
      }

      if (data.users[user] !== pass) return res.end("❌ Invalid credentials");

      const token = Math.random().toString(36).slice(2);
      SESSIONS[token] = { username: user, created: Date.now() };
      res.writeHead(200, { "Set-Cookie": `token=${token}; HttpOnly` });
      res.end("✅ OK");
    });
  }

  if (req.method === "POST" && req.url === "/action" && username) {
    parseBody(req, p => {
      const index = 0;
      const act = p.get("act");
      const ip = p.get("ip");

      if (act === "launch" && !data.usedButtons[index]) {
        if (data.botDetails.find(d => d?.owner === username)) return res.end("❌ One bot only per user");
        if (!ip.includes(":")) return res.end("❌ Must be IP:Port");
        data.usedButtons[index] = true;
        data.botDetails[index] = { ip, owner: username };
        saveData();
        launchBot(ip, index);
        return res.end("✅ Bot launched");
      }

      if (act === "edit" && data.botDetails[index]?.owner === username) {
        if (!ip.includes(":")) return res.end("❌ Must be IP:Port");
        data.botDetails[index].ip = ip;
        if (activeBots[index]) activeBots[index].quit();
        launchBot(ip, index);
        saveData();
        return res.end("✏️ Edited");
      }

      if (act === "cancel" && data.botDetails[index]?.owner === username) {
        if (activeBots[index]) activeBots[index].quit();
        data.usedButtons[index] = false;
        data.botDetails[index] = null;
        botStatus[index] = "Offline";
        activeBots[index] = null;
        saveData();
        return res.end("🛑 Cancelled");
      }

      if (act === "reconnect" && data.botDetails[index]?.owner === username) {
        if (activeBots[index]) activeBots[index].quit();
        setTimeout(() => launchBot(data.botDetails[index].ip, index), 1000);
        return res.end("🔁 Reconnecting");
      }

      if (act === "logout") {
        const token = (req.headers.cookie || "").split("token=")[1]?.split(";")[0];
        if (token) delete SESSIONS[token];
        res.writeHead(200, { "Set-Cookie": "token=; Max-Age=0" });
        return res.end("✅ Logged out");
      }

      res.end("❌ Action failed");
    });
  }
}).listen(PORT);

function renderHTML(user) {
  const css = `
  <style>
    body { background:#111; color:white; font-family:sans-serif; padding:20px; text-align:center }
    input,button { padding:10px; margin:5px; width:80%; max-width:250px; border:none; border-radius:5px }
    .green { color:lightgreen; } .red { color:red; } .log { background:#000; color:#0f0; width:90%; height:150px }
    .box { border:1px solid #444; padding:10px; margin:10px auto; width:280px; border-radius:10px; background:#222; }
  </style>
  `;

  const loginPage = `
    <h2>SKYBOT LOGIN / SIGNUP</h2>
    <input id="user" placeholder="Username"><br>
    <input id="pass" type="password" placeholder="Password"><br>
    <button onclick="auth('register')">Sign Up</button>
    <button onclick="auth('login')">Log In</button>
    <p id="msg"></p>
  `;

  const i = data.botDetails.findIndex(d => d?.owner === user);
  const index = i === -1 ? data.usedButtons.findIndex(u => !u) : i;
  const d = data.botDetails[index];
  const s = botStatus[index] === "Online" ? `<span class='green'>Online</span>` : `<span class='red'>Offline</span>`;
  const ip = d?.ip || "";
  const isOwner = d?.owner === user;

  const panel = `
    <h2>Welcome, ${user} <button onclick="send(null, 'logout')">Logout</button></h2>
    <div class="box">
      <input id="ip${index}" value="${ip}" placeholder="LOYALSMP56734:62808" ${!isOwner && d ? 'disabled' : ''}>
      ${!d ? `<button onclick="send(${index},'launch')">Send</button>` :
        isOwner ? `
          <button onclick="send(${index},'edit')">Edit</button>
          <button onclick="send(${index},'cancel')">Cancel</button>
          <button onclick="send(${index},'reconnect')">Reconnect</button>` :
        '<button disabled>In Use</button>'}
      Status: ${s}
    </div>
    <h3>Your Bot Logs</h3>
    <textarea readonly id="logs" class="log"></textarea>
  `;

  return `
  <html><head><title>SKYBOT HOST</title>${css}</head><body>
  ${user ? panel : loginPage}
  <script>
    function auth(type) {
      const u = document.getElementById('user').value;
      const p = document.getElementById('pass').value;
      fetch("/auth", {
        method: "POST",
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: "user=" + encodeURIComponent(u) + "&pass=" + encodeURIComponent(p) + "&type=" + type
      }).then(r => r.text()).then(t => {
        const msg = document.getElementById("msg");
        if (msg) msg.innerHTML = t.includes("✅") ? "<span class='green'>" + t + "</span>" : "<span class='red'>" + t + "</span>";
        if (t.includes("✅")) setTimeout(() => location.reload(), 1000);
      });
    }

    function send(i, act) {
      let ip = i !== null ? document.getElementById("ip"+i)?.value : "";
      fetch("/action", {
        method: "POST",
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: "index=" + i + "&act=" + act + "&ip=" + encodeURIComponent(ip)
      }).then(r => r.text()).then(t => alert(t));
    }

    setInterval(() => {
      fetch("/status").then(r => r.json()).then(d => {
        d.status.forEach((s, i) => {
          const el = document.querySelector("#ip"+i)?.parentElement?.querySelector("span");
          if (el) {
            el.textContent = s;
            el.className = s === "Online" ? "green" : "red";
          }
        });
      });
      fetch("/logs").then(r => r.text()).then(txt => {
        const log = document.getElementById("logs");
        if (log) log.value = txt;
      });
    }, 3000);
  </script>
  </body></html>`;
}
