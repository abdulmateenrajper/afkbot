const { execSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const mineflayer = require('mineflayer');
const crypto = require('crypto');
const url = require('url');

// Auto-install if needed
try { require.resolve('mineflayer'); } catch (e) {
  console.log('📦 Installing mineflayer...');
  execSync('npm install mineflayer', { stdio: 'inherit' });
}

// Max limits
const MAX_USERS = 10;
const MAX_BOTS = 10;

// File-based user storage
const USERS_FILE = './users.json';
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');

let users = JSON.parse(fs.readFileSync(USERS_FILE));
let sessions = {}; // token => username

let bots = {}; // botId => botInstance
let botLogs = {}; // botId => logs[]

function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function createBot(botId, ip, port, name, password = 'Mishra@123') {
  if (Object.keys(bots).length >= MAX_BOTS) return log(botId, '❌ Max bots reached');

  const bot = mineflayer.createBot({ host: ip, port: parseInt(port), username: name });
  bots[botId] = bot;
  botLogs[botId] = [];

  function log(botId, msg) {
    const entry = `[${new Date().toISOString()}] ${msg}`;
    console.log(`[${botId}] ${msg}`);
    botLogs[botId].push(entry);
    if (botLogs[botId].length > 100) botLogs[botId].shift();
  }

  log(botId, `✅ Bot created for ${ip}:${port} as ${name}`);

  let firstJoin = true;
  bot.on('spawn', () => {
    log(botId, '🟢 Spawned');
    if (firstJoin) {
      setTimeout(() => bot.chat(`/register ${password} ${password}`), 2000);
      firstJoin = false;
    }
    setTimeout(() => bot.chat(`/login ${password}`), 5000);
  });

  bot.on('end', () => {
    log(botId, '🔁 Disconnected');
    delete bots[botId];
  });

  bot.on('error', err => log(botId, `⚠️ Error: ${err.message}`));
  bot.on('kicked', reason => log(botId, `🚫 Kicked: ${reason}`));
}

// 🌐 Web Server
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  const { pathname, query } = url.parse(req.url, true);

  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(renderHTML());
  }

  if (req.method === 'POST' && pathname === '/api/register') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { username, password } = JSON.parse(body);
      if (users.length >= MAX_USERS)
        return sendJSON(res, { success: false, message: 'Max users reached' });
      if (users.find(u => u.username === username))
        return sendJSON(res, { success: false, message: 'Username exists' });

      users.push({ username, password });
      saveUsers();
      return sendJSON(res, { success: true });
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/login') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { username, password } = JSON.parse(body);
      const user = users.find(u => u.username === username && u.password === password);
      if (!user) return sendJSON(res, { success: false, message: 'Invalid credentials' });

      const token = crypto.randomBytes(16).toString('hex');
      sessions[token] = username;
      return sendJSON(res, { success: true, token });
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/start') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { token, ip, port, name } = JSON.parse(body);
        if (!sessions[token]) return sendJSON(res, { success: false, message: 'Unauthorized' });

        const botId = `${name}_${Date.now()}`;
        createBot(botId, ip, port, name);
        return sendJSON(res, { success: true, botId });
      } catch (e) {
        return sendJSON(res, { success: false, message: e.message });
      }
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/logs') {
    const botId = query.id;
    if (botId && botLogs[botId]) {
      return sendPlain(res, botLogs[botId].join('\n'));
    }
    return sendPlain(res, 'No logs.');
  }

  if (req.method === 'POST' && pathname === '/api/command') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { botId, command } = JSON.parse(body);
      const bot = bots[botId];
      if (!bot) return sendJSON(res, { success: false, message: 'Bot not found' });

      bot.chat(command);
      botLogs[botId].push(`[${new Date().toISOString()}] 📤 ${command}`);
      return sendJSON(res, { success: true });
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
}).listen(PORT, () => console.log(`🌍 Running at http://localhost:${PORT}`));

// Helpers
function sendJSON(res, obj) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}
function sendPlain(res, txt) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(txt);
}
function renderHTML() {
  return `
<!DOCTYPE html>
<html><head><title>SKYBOT PANEL</title>
<style>
  body { background:#111;color:#0f0;font-family:monospace;padding:20px }
  input,button { background:#222;color:#0f0;border:1px solid #0f0;padding:5px;margin:2px }
  #log { white-space:pre-wrap;background:#000;border:1px solid #0f0;height:200px;overflow:auto;margin-top:10px }
</style>
</head><body>
<h2>SKYBOT Panel</h2>

<div id="auth">
  <input id="user" placeholder="Username">
  <input id="pass" placeholder="Password" type="password">
  <button onclick="register()">Register</button>
  <button onclick="login()">Login</button>
</div>

<div id="control" style="display:none;">
  <p>Welcome, <span id="uname"></span>!</p>
  <input id="ip" placeholder="IP"> <input id="port" placeholder="Port">
  <input id="bot" placeholder="Bot Name">
  <button onclick="startBot()">Start Bot</button>

  <br><input id="cmd" placeholder="Command"> 
  <button onclick="sendCommand()">Send</button>

  <div id="log">Logs...</div>
</div>

<script>
let token = "", botId = "";

function register() {
  fetch('/api/register', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ username: user.value, password: pass.value })
  }).then(r => r.json()).then(d => alert(d.message || 'Registered'));
}

function login() {
  fetch('/api/login', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ username: user.value, password: pass.value })
  }).then(r => r.json()).then(d => {
    if (d.success) {
      token = d.token;
      uname.innerText = user.value;
      auth.style.display = 'none';
      control.style.display = 'block';
    } else alert(d.message);
  });
}

function startBot() {
  fetch('/api/start', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ token, ip: ip.value, port: port.value, name: bot.value })
  }).then(r => r.json()).then(d => {
    if (d.success) {
      botId = d.botId;
      setInterval(fetchLogs, 1000);
    } else alert(d.message);
  });
}

function fetchLogs() {
  if (!botId) return;
  fetch('/api/logs?id=' + botId).then(r => r.text()).then(t => log.innerText = t);
}

function sendCommand() {
  if (!botId) return;
  fetch('/api/command', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ botId, command: cmd.value })
  });
  cmd.value = '';
}
</script>
</body></html>`;
}
