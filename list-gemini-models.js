
// const fetch = require('node-fetch'); // Using native fetch

async function listGeminiModels() {
    // We need the key from .env.local usually, but I'll try to read it or expect it.
    // I know the key from previous steps. 
    // GOOGLE_GENERATIVE_AI_API_KEY=AIzaSyCGCNP31YTkQPMsWfJQUn8gYUTYS0MdhyE (from Step 2310)
    
    const apiKey = "AIzaSyCGCNP31YTkQPMsWfJQUn8gYUTYS0MdhyE";
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error("Failed:", response.status, await response.text());
            return;
        }

        const data = await response.json();
        const fs = require('fs');
        fs.writeFileSync('gemini_models_full.json', JSON.stringify(data, null, 2));
        console.log("Wrote models to gemini_models_full.json");
    } catch (e) {
        console.error("Error:", e);
    }
}

listGeminiModels();
