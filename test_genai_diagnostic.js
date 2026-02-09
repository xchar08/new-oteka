const https = require('https');
const fs = require('fs');
const path = require('path');

// 1. Read API Key from .env.local
const envPath = path.join(__dirname, '.env.local');
let apiKey = '';

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.*)/);
  if (match && match[1]) {
    apiKey = match[1].trim().replace(/^["']|["']$/g, ''); // Remove quotes if present
  }
} catch (e) {
  console.error("Error reading .env.local:", e.message);
  process.exit(1);
}

if (!apiKey) {
  console.error("GOOGLE_GENERATIVE_AI_API_KEY not found in .env.local");
  process.exit(1);
}

console.log(`API Key found (starts with: ${apiKey.substring(0, 8)}...)`);

// 2. Test Function
async function testModel(modelName) {
  console.log(`\n--- Testing ${modelName} ---`);
  
  const postData = JSON.stringify({
    contents: [{
      parts: [{ text: "Hello, this is a connectivity test. Respond with 'OK'." }]
    }]
  });

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        if (res.statusCode === 200) {
            try {
                const json = JSON.parse(data);
                const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                console.log(`Success! Response: "${text?.trim()}"`);
                resolve(true);
            } catch (e) {
                console.log(`Response Body: ${data.substring(0, 200)}...`);
            }
        } else {
           console.log(`Error Body: ${data.substring(0, 500)}`); // Show error details
           resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      console.error(`Request Error: ${e.message}`);
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

// 3. Execution
async function run() {
  console.log("Starting Gemini API Diagnostics...");
  
  // Test 1: Gemini 3.0 Flash Preview (Primary)
  await testModel('gemini-3-flash-preview');

  // Test 2: Gemini 2.0 Flash (Fallback - FAILED previously)
  // await testModel('gemini-2.0-flash'); 

  // Test 3: Gemini 1.5 Flash (Stable) - FAILED (404)
  // await testModel('gemini-1.5-flash');

  // Test 4: Gemini 2.5 Flash (New)
  await testModel('gemini-2.5-flash');

  // Test 5: Gemini 2.0 Flash Lite (Cost effective)
  await testModel('gemini-2.0-flash-lite');

  console.log("\nDiagnostics Complete.");
}

run();
