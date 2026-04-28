
// const fetch = require('node-fetch'); // Using native fetch

async function listModels() {
    const apiKey = "v1.CmQKHHN0YXRpY2tleS1lMDBkcnh6YmRkODE4ejh4dnYSIXNlcnZpY2VhY2NvdW50LWUwMGYyamg0eWRneHJ4MnQwbTIMCJye3MsGENz0s7kCOgwInKH0lgcQgLjB7AFAAloDZTAw.AAAAAAAAAAFpEdxt4Gl9dqNSWQZvyIS45YWRmmE_RYyLOlWAYWpVi085GmtXo8HLtuCxn3SX2h0tCvG74-Rlxoz8kNOs2kwP";
    const url = "https://api.studio.nebius.ai/v1/models";

    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            console.error("Failed:", response.status, await response.text());
            return;
        }

        const data = await response.json();
        console.log("Models:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

listModels();
