
const apiKey = "AIzaSyCGCNP31YTkQPMsWfJQUn8gYUTYS0MdhyE"; // Retrieved from previously visible env file

async function testModel(modelId, version = "v1beta") {
    const url = `https://generativelanguage.googleapis.com/${version}/models/${modelId}:generateContent?key=${apiKey}`;
    
    console.log(`Testing ${modelId} on ${version}...`);
    
    const payload = {
        contents: [{
            role: "user",
            parts: [{ text: "Hello" }]
        }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`FAILED ${modelId} (${version}):`, response.status, await response.text());
        } else {
            console.log(`SUCCESS ${modelId} (${version})`);
        }
    } catch (e) {
        console.error(`ERROR ${modelId}:`, e);
    }
}

async function run() {
    await testModel("gemini-3-flash-preview", "v1beta");
    await testModel("gemini-3-pro-preview", "v1beta");
    await testModel("gemini-2.5-flash", "v1beta");
}

run();
