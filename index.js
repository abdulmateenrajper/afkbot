const fs = require('fs');
const http = require('http');
const mineflayer = require('mineflayer');
const crypto = require('crypto');
const { parse } = require('url');

const MAX_USERS = 20;
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
    bot.chat('/login Mishra@123');
    setTimeout(() => bot.chat('/register Mishra@123'), 1000);
    log(botId, `🟢 Sent /login + /register`);
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
  const send = (code, data) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(renderHTML());
  }

  if (req.method === 'POST' && url.pathname === '/api/login') {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      const { username, password } = JSON.parse(data);
      const user = users[username];
      if (user && user.password === password)
        return send(200, { success: true, token: username + '_token' });
      else return send(200, { success: false, message: 'Invalid credentials. Please try again or create an account.' });
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/register') {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      const { username, password } = JSON.parse(data);
      if (Object.keys(users).length >= MAX_USERS)
        return send(200, { success: false, message: 'User limit reached' });
      if (users[username]) return send(200, { success: false, message: 'Username exists' });
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
        return send(200, { success: false, message: 'Bot limit reached' });
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
        log(botId, `📤 Sent command: ${command}`);
      }
      return send(200, { success: true });
    });
  }

  res.writeHead(404);
  res.end('Not found');
}).listen(process.env.PORT || 3000, () => {
  console.log(`🌐 Server running on port ${process.env.PORT || 3000}`);
});

function renderHTML() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>SKYBOT HOST</title>
  <style>
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
    #auth, #register, #control {
      max-width: 400px;
      margin: 30px auto;
      background: white;
      color: black;
      padding: 20px;
      border-radius: 15px;
      box-shadow: 0 0 20px #0f0;
    }
    input, button {
      width: 100%;
      padding: 10px;
      margin-top: 10px;
      border: none;
      border-radius: 10px;
      font-family: monospace;
      font-size: 14px;
    }
    input {
      background: #f0f0f0;
    }
    button {
      background: #111;
      color: #0f0;
      cursor: pointer;
      border: 1px solid #0f0;
    }
    button:hover {
      background: #0f0;
      color: black;
    }
    #log {
      margin-top: 15px;
      padding: 10px;
      background: #000;
      border-radius: 10px;
      height: 200px;
      overflow-y: scroll;
      white-space: pre-wrap;
      font-size: 13px;
    }
    .green { color: #0f0; }
    .red { color: #f00; }
    .popup {
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 10px 15px;
      border-radius: 5px;
      font-weight: bold;
      background-color: #222;
      color: #fff;
      box-shadow: 0 0 10px #0f0;
      z-index: 9999;
    }
    .popup.error { background-color: #f00; color: white; }
    .popup.success { background-color: #0f0; color: black; }
    .discord-button {
      text-align: center;
      margin: 50px 0;
    }
    .discord-button a {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 15px 25px;
      background: #5865F2;
      color: white;
      font-weight: bold;
      font-family: monospace;
      border-radius: 12px;
      text-decoration: none;
      box-shadow: 0 0 10px #5865F2;
      font-size: 18px;
    }
    .discord-button img {
      height: 24px;
      filter: invert(1);
    }
  </style>
</head>
<body>
  <div id="top">SKYBOT HOST</div>

  <div id="auth">
    <input id="user" placeholder="Username">
    <input id="pass" placeholder="Password" type="password">
    <button onclick="login()">Login</button>
    <p style="text-align:center; margin-top:10px;"><a href="#" onclick="showRegister()" style="color:#0f0;">New here? Create account</a></p>
  </div>

  <div id="register" style="display:none;">
    <input id="newuser" placeholder="New Username">
    <input id="newpass" placeholder="New Password" type="password">
    <button onclick="register()">Create Account</button>
    <p style="text-align:center; margin-top:10px;"><a href="#" onclick="showLogin()" style="color:#0f0;">Already have an account? Login</a></p>
  </div>

  <div id="control" style="display:none;">
    <p>Welcome, <span id="uname"></span>!</p>
    <input id="ip" placeholder="IP">
    <input id="port" placeholder="Port">
    <input id="bot" placeholder="Bot Name">
    <button onclick="startBot()">Start Bot</button>
    <input id="cmd" placeholder="Command">
    <button onclick="sendCommand()">Send</button>
    <div id="log">Logs...</div>
  </div>

  <div class="discord-button">
    <a href="https://discord.gg/your-invite" target="_blank">
      <img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/discord.svg">
      Join our Discord
    </a>
  </div>

<script>
let token = "", botId = "";

function showPopup(msg, type = 'success') {
  const div = document.createElement('div');
  div.className = 'popup ' + type;
  div.innerText = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

function showRegister() {
  document.getElementById('auth').style.display = 'none';
  document.getElementById('register').style.display = 'block';
}

function showLogin() {
  document.getElementById('register').style.display = 'none';
  document.getElementById('auth').style.display = 'block';
}

function login() {
  fetch('/api/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ username: user.value, password: pass.value })
  }).then(r => r.json()).then(d => {
    if (d.success) {
      token = d.token;
      uname.innerText = user.value;
      auth.style.display = 'none';
      control.style.display = 'block';
      showPopup('✅ Logged in!', 'success');
    } else showPopup(d.message, 'error');
  });
}

function register() {
  fetch('/api/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ username: newuser.value, password: newpass.value })
  }).then(r => r.json()).then(d => {
    if (d.success) {
      showPopup('✅ Registered! Please log in.', 'success');
      showLogin();
    } else showPopup(d.message, 'error');
  });
}

function startBot() {
  fetch('/api/start', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ token, ip: ip.value, port: port.value, name: bot.value })
  }).then(r => r.json()).then(d => {
    if (d.success) {
      botId = d.botId;
      setInterval(fetchLogs, 1000);
    } else showPopup(d.message, 'error');
  });
}

function fetchLogs() {
  if (!botId) return;
  fetch('/api/logs?id=' + botId).then(r => r.text()).then(t => {
    const lines = t.split('\\n').map(line =>
      line.includes('✅') || line.includes('🟢') ? '<div class="green">' + line + '</div>' :
      line.includes('⚠️') || line.includes('⛔') || line.includes('🔁') ? '<div class="red">' + line + '</div>' :
      '<div>' + line + '</div>'
    );
    document.getElementById('log').innerHTML = lines.join('');
  });
}

function sendCommand() {
  if (!botId) return;
  fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ botId, command: cmd.value })
  });
  cmd.value = '';
}
</script>
</body>
</html>`;
}
