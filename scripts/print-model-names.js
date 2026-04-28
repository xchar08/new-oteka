const fs = require('fs');
try {
    const data = JSON.parse(fs.readFileSync('gemini_models_full.json', 'utf8'));
    if (data.models) {
        data.models.forEach(m => console.log(m.name));
    } else {
        console.log("No models property found, invalid JSON structure?");
        console.log(Object.keys(data));
    }
} catch (e) {
    console.error(e);
}
