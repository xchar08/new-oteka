const https = require('https');

const API_KEY = "v1.CmQKHHN0YXRpY2tleS1lMDBkcnh6YmRkODE4ejh4dnYSIXNlcnZpY2VhY2NvdW50LWUwMGYyamg0eWRneHJ4MnQwbTIMCJye3MsGENz0s7kCOgwInKH0lgcQgLjB7AFAAloDZTAw.AAAAAAAAAAFpEdxt4Gl9dqNSWQZvyIS45YWRmmE_RYyLOlWAYWpVi085GmtXo8HLtuCxn3SX2h0tCvG74-Rlxoz8kNOs2kwP";
const MODEL = "deepseek-ai/DeepSeek-V3.2"; // Verified working version

const options = {
  hostname: 'api.studio.nebius.ai',
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(data);
  });
});

req.on('error', (e) => {
  console.error(`Problem: ${e.message}`);
});

req.write(JSON.stringify({
  model: MODEL,
  messages: [{ role: "user", content: "Hi" }],
  max_tokens: 10
}));

req.end();
