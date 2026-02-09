const https = require('https');

const API_KEY = "v1.CmQKHHN0YXRpY2tleS1lMDBkcnh6YmRkODE4ejh4dnYSIXNlcnZpY2VhY2NvdW50LWUwMGYyamg0eWRneHJ4MnQwbTIMCJye3MsGENz0s7kCOgwInKH0lgcQgLjB7AFAAloDZTAw.AAAAAAAAAAFpEdxt4Gl9dqNSWQZvyIS45YWRmmE_RYyLOlWAYWpVi085GmtXo8HLtuCxn3SX2h0tCvG74-Rlxoz8kNOs2kwP";

const options = {
  hostname: 'api.studio.nebius.ai',
  path: '/v1/models',
  method: 'GET',
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
    if (res.statusCode === 200) {
      console.log('--- NEBIUS MODELS ---');
      const json = JSON.parse(data);
      json.data.forEach(m => console.log(m.id));
      console.log('---------------------');
    } else {
      console.error(`Error: ${res.statusCode} - ${data}`);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();
