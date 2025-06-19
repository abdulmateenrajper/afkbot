const fs = require('fs');
const http = require('http');
const mineflayer = require('mineflayer');
const crypto = require('crypto');
const { parse } = require('url');

const MAX_USERS = 500;
const MAX_BOTS = 20;
const bots = {};
const logs = {};
const users = fs.existsSync('users.json') ? JSON.parse(fs.readFileSync('users.json')) : {};

function saveUsers() {
  fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
}
function generateId() {
  return crypto.randomBytes(8).toString('hex');
}
function log(botId, msg) {
  const ts = new Date().toLocaleTimeString();
  const line = `[${ts}] ${msg}`;
  logs[botId] = logs[botId] || [];
  logs[botId].push(line);
  if (logs[botId].length > 100) logs[botId].shift();
  console.log(`[${botId}] ${msg}`);
}
function createBot(botId, ip, port, name) {
  const bot = mineflayer.createBot({
    host: ip,
    port: parseInt(port),
    username: name || `Bot${Math.floor(Math.random() * 9999)}`,
    auth: 'offline'
  });

  bots[botId] = bot;
  log(botId, `🟢 Created bot ${bot.username} (${ip}:${port})`);

  bot.on('login', () => log(botId, `✅ Logged in as ${bot.username}`));
  bot.on('spawn', () => {
    log(botId, `🟢 Spawned`);
  });
  bot.on('kicked', r => log(botId, `⛔ Kicked: ${r}`));
  bot.on('end', () => {
    log(botId, `🔁 Disconnected. Rejoining in 5s...`);
    setTimeout(() => createBot(botId, ip, port, name), 5000);
  });
  bot.on('error', e => log(botId, `⚠️ Error: ${e.message}`));
}

http.createServer((req, res) => {
  const url = parse(req.url, true);
  const page = url.query.page || 'login';

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(renderHTML(page));
  }

  const send = (code, data) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  if (req.method === 'POST' && url.pathname === '/api/login') {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      const { username, password } = JSON.parse(data);
      const user = users[username];
      if (user && user.password === password)
        return send(200, { success: true, token: username + '_token' });
      else return send(200, { success: false, message: '❌ Invalid credentials' });
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/register') {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      const { username, password } = JSON.parse(data);
      if (users[username]) return send(200, { success: false, message: '⚠️ Username exists' });
      if (Object.keys(users).length >= MAX_USERS)
        return send(200, { success: false, message: '🚫 Max users reached' });
      users[username] = { password };
      saveUsers();
      return send(200, { success: true });
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/start') {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      const { token, ip, port, name } = JSON.parse(data);
      if (Object.keys(bots).length >= MAX_BOTS)
        return send(200, { success: false, message: '❌ Bot limit reached' });
      const botId = generateId();
      createBot(botId, ip, port, name);
      return send(200, { success: true, botId });
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/logs') {
    const id = url.query.id;
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end((logs[id] || []).join('\n'));
  }

  if (req.method === 'POST' && url.pathname === '/api/command') {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      const { botId, command } = JSON.parse(data);
      if (bots[botId]) {
        bots[botId].chat(command);
        log(botId, `📤 Sent: ${command}`);
      }
      return send(200, { success: true });
    });
  }

  res.writeHead(404);
  res.end('Not found');
}).listen(process.env.PORT || 3000, () => {
  console.log(`🌐 Server running on port ${process.env.PORT || 3000}`);
});

function renderHTML(page) {
  return `
<!DOCTYPE html>
<html><head><title>SKYBOT HOST</title><style>
body {
  background: #0d0d0d;
  color: #0f0;
  font-family: monospace;
  margin: 0;
  padding: 0;
}
#top {
  text-align: left;
  padding: 15px;
  font-size: 20px;
  font-weight: bold;
  color: white;
}
#login, #register, #panel {
  max-width: 400px;
  margin: 50px auto;
  background: white;
  color: black;
  padding: 20px;
  border-radius: 15px;
  box-shadow: 0 0 20px #0f0;
  display: none;
}
input, button {
  width: 100%;
  padding: 10px;
  margin-top: 10px;
  border-radius: 10px;
  font-size: 14px;
  font-family: monospace;
}
button {
  background: #111;
  color: #0f0;
  border: 1px solid #0f0;
  cursor: pointer;
}
button:hover {
  background: #0f0;
  color: black;
}
#log {
  margin-top: 10px;
  background: black;
  color: #0f0;
  height: 200px;
  overflow-y: scroll;
  padding: 10px;
  border-radius: 10px;
  font-size: 12px;
}
.popup {
  position: fixed;
  top: 10px;
  right: 10px;
  background: #222;
  color: white;
  padding: 10px 15px;
  border-radius: 8px;
  z-index: 999;
}
.popup.error { background: red; color: white; }
.popup.success { background: #0f0; color: black; }
#discord {
  position: fixed;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
}
</style></head>
<body>
<div id="top">SKYBOT HOST</div>

<div id="login">
  <input id="user" placeholder="Username">
  <input id="pass" type="password" placeholder="Password">
  <button onclick="login()">Login</button>
  <p style="text-align:center;"><a href="/?page=register" style="color:#0f0;">New here? Create account</a></p>
</div>

<div id="register">
  <input id="newuser" placeholder="New Username">
  <input id="newpass" type="password" placeholder="New Password">
  <button onclick="register()">Register</button>
  <p style="text-align:center;"><a href="/?page=login" style="color:#0f0;">Already have account?</a></p>
</div>

<div id="panel">
  <p>Welcome, <span id="uname"></span>!</p>
  <input id="ip" placeholder="Server IP">
  <input id="port" placeholder="Port">
  <input id="bot" placeholder="Bot Name">
  <button onclick="startBot()">Start Bot</button>
  <input id="cmd" placeholder="Command">
  <button onclick="sendCommand()">Send</button>
  <div id="log">Logs...</div>
</div>

<div id="discord">
  <a href="https://discord.gg/hsJmmvYpCG" target="_blank">
    <button style="background:#5865F2; color:white; font-weight:bold; font-size:14px;">💬 Join our Discord</button>
  </a>
</div>

<script>
let token = "", botId = "";

window.onload = () => {
  const page = '${page}';
  if (page === 'register') registerDiv.style.display = 'block';
  else if (page === 'panel') panel.style.display = 'block';
  else loginDiv.style.display = 'block';
};

function showPopup(msg, type='success') {
  const div = document.createElement('div');
  div.className = 'popup ' + type;
  div.innerText = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}
function login() {
  fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ username: user.value, password: pass.value })
  }).then(r => r.json()).then(d => {
    if (d.success) {
      token = d.token;
      uname.innerText = user.value;
      loginDiv.style.display = 'none';
      panel.style.display = 'block';
      showPopup('✅ Logged in!', 'success');
    } else showPopup(d.message, 'error');
  });
}
function register() {
  fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ username: newuser.value, password: newpass.value })
  }).then(r => r.json()).then(d => {
    if (d.success) {
      showPopup('✅ Account created!', 'success');
      location.href = '/?page=login';
    } else showPopup(d.message, 'error');
  });
}
function startBot() {
  fetch('/api/start', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ token, ip: ip.value, port: port.value, name: bot.value })
  }).then(r => r.json()).then(d => {
    if (d.success) {
      botId = d.botId;
      setInterval(fetchLogs, 1000);
    } else showPopup(d.message, 'error');
  });
}
function sendCommand() {
  fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ botId, command: cmd.value })
  });
  cmd.value = '';
}
function fetchLogs() {
  fetch('/api/logs?id=' + botId).then(r => r.text()).then(t => {
    log.innerHTML = t.split('\\n').map(line =>
      line.includes('✅') || line.includes('🟢') ? '<div style="color:#0f0">'+line+'</div>' :
      line.includes('⚠️') || line.includes('⛔') || line.includes('🔁') ? '<div style="color:red">'+line+'</div>' :
      '<div>'+line+'</div>'
    ).join('');
  });
}
</script>
</body></html>`;
}
