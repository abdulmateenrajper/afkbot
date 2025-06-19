function renderHTML() {
  return `
<!DOCTYPE html>
<html><head><title>SKYBOT HOST</title>
<style>
  body {
    background: #0d0d0d;
    color: #0f0;
    font-family: monospace;
    margin: 0;
    padding: 0;
  }
  #top {
    text-align: right;
    padding: 15px;
    font-size: 20px;
    font-weight: bold;
    color: white;
  }
  #auth, #control {
    max-width: 400px;
    margin: 50px auto;
    background: white;
    color: black;
    padding: 20px;
    border-radius: 15px;
    box-shadow: 0 0 20px #00ff00;
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
  .eye {
    position: absolute;
    right: 30px;
    top: 39px;
    cursor: pointer;
    color: #888;
  }
</style>
</head><body>
<div id="top">SKYBOT HOST</div>

<div id="auth">
  <input id="user" placeholder="Username">
  <div style="position:relative;">
    <input id="pass" placeholder="Password" type="password">
    <span class="eye" onclick="togglePass()">👁️</span>
  </div>
  <button onclick="auth()">Login / Signup</button>
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

<script>
let token = "", botId = "";

function togglePass() {
  pass.type = pass.type === "password" ? "text" : "password";
}

function auth() {
  fetch('/api/login', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ username: user.value, password: pass.value })
  }).then(r => r.json()).then(d => {
    if (d.success) {
      loginSuccess(d.token);
    } else {
      // try register
      fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ username: user.value, password: pass.value })
      }).then(r => r.json()).then(d => {
        if (d.success) {
          alert("✅ Registered, now logging in...");
          auth();
        } else alert(d.message);
      });
    }
  });
}

function loginSuccess(tok) {
  token = tok;
  uname.innerText = user.value;
  auth.style.display = 'none';
  control.style.display = 'block';
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
  fetch('/api/logs?id=' + botId).then(r => r.text()).then(t => {
    const lines = t.split('\\n').map(line =>
      line.includes('✅') || line.includes('🟢') ? '<div class="green">'+line+'</div>' :
      line.includes('⚠️') || line.includes('🚫') || line.includes('🔁') ? '<div class="red">'+line+'</div>' :
      '<div>'+line+'</div>'
    );
    log.innerHTML = lines.join('');
  });
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
</body></html>
  `;
}

}
</script>
</body></html>`;
}
