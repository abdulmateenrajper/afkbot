
const https = require("https");

function sendDiscordDM(userId, message) {
  const data = JSON.stringify({
    recipient_id: userId,
    content: message
  });

  const options = {
    hostname: "discord.com",
    path: `/api/v9/users/@me/messages`,
    method: "POST",
    headers: {
      "Authorization": `TOKEN`,
      "Content-Type": "application/json",
      "Content-Length": data.length
    }
  };

  const req = https.request(options, res => {
    console.log(`📬 DM sent: Status ${res.statusCode}`);
  });

  req.on("error", error => {
    console.error("❌ Error sending DM:", error);
  });

  req.write(data);
  req.end();
}

module.exports = { sendDiscordDM };
