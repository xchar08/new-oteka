const fs = require('fs');
const path = require('path');

async function listGeminiModels() {
    // 1. Read API Key from .env.local
    const envPath = path.join(__dirname, '.env.local');
    let apiKey = '';

    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.*)/);
      if (match && match[1]) {
        apiKey = match[1].trim().replace(/^["']|["']$/g, ''); 
      }
    } catch (e) {
      console.error("Error reading .env.local:", e.message);
      return;
    }

    if (!apiKey) {
      console.error("GOOGLE_GENERATIVE_AI_API_KEY not found");
      return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error("Failed:", response.status, await response.text());
            return;
        }

        const data = await response.json();
        const flashModels = data.models?.filter(m => m.name.includes('flash')).map(m => m.name);
        
        console.log("Flash Models Available:", flashModels);
        
        fs.writeFileSync('gemini_models_full.json', JSON.stringify(data, null, 2));
        console.log("Wrote full list to gemini_models_full.json");
    } catch (e) {
        console.error("Error:", e);
    }
}

listGeminiModels();
