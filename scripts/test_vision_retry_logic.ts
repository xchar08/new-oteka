// scripts/test_vision_retry_logic.ts
// Run with: deno run --allow-net --allow-env scripts/test_vision_retry_logic.ts

console.log("🧪 Testing Vision Pipeline Retry Logic (Simulation)...\n");

const MOCK_MODELS = [
    "gemini-3-flash-preview",
    "gemini-2.0-flash",
    "gemini-1.5-flash-002",
];

// Mock Fetch Environment
const originalFetch = globalThis.fetch;
let callCount = 0;
const startTimes = {};

// Override Fetch to Simulate Failures
globalThis.fetch = async (url, options) => {
    const modelMatch = url.toString().match(/models\/(.*?):generateContent/);
    const model = modelMatch ? modelMatch[1] : "unknown";

    callCount++;
    const now = Date.now();
    startTimes[callCount] = now;

    console.log(
        `[MockFetch] Request #${callCount} -> Model: ${model} at ${
            new Date(now).toISOString().split("T")[1]
        }`,
    );

    // Scenario: Gemini 3.0 fails with 429
    if (model.includes("gemini-3")) {
        console.log(`   Detailed: Simulating 429 Rate Limit for ${model}`);
        return new Response(
            JSON.stringify({ error: { code: 429, message: "Quota Exceeded" } }),
            { status: 429 },
        );
    }

    // Scenario: Gemini 2.0 fails with 503
    if (model.includes("gemini-2.0")) {
        console.log(`   Detailed: Simulating 503 Overloaded for ${model}`);
        return new Response("Service Unavailable", { status: 503 });
    }

    // Scenario: Gemini 1.5 succeeds
    if (model.includes("gemini-1.5")) {
        console.log(`   Detailed: Simulating Success for ${model}`);
        return new Response(
            JSON.stringify({
                candidates: [{
                    content: { parts: [{ text: "Mock Description Success" }] },
                }],
            }),
            { status: 200 },
        );
    }

    return new Response("Unknown Model", { status: 400 });
};

// Re-implement the key logic from vision-pipeline/index.ts for testing
// (We can't easily import the Deno Function directly due to environment differences, so we test the Logic Pattern)
async function testRetryLogic() {
    console.log("--- Starting Retry Logic Test ---\n");

    let sceneDescription = "";

    for (const model of MOCK_MODELS) {
        console.log(`\n--- Loop Iteration for ${model} ---`);
        const tStart = Date.now();

        try {
            const descUrl =
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
            const descRes = await fetch(descUrl, { method: "POST" });

            if (descRes.ok) {
                console.log(`✅ Model ${model} Verified Success!`);
                break;
            } else {
                console.warn(
                    `⚠️ Model ${model} Failed (Status ${descRes.status})`,
                );

                // TEST THE DELAY LOGIC
                console.log(`⏳ Triggering Safety Delay (1000ms)...`);
                const delayStart = Date.now();
                await new Promise((r) => setTimeout(r, 1000));
                const delayEnd = Date.now();
                console.log(`   Delay Actual: ${delayEnd - delayStart}ms`);
            }
        } catch (e) {
            console.error("Fetch usage error:", e);
        }
    }
}

// execute
await testRetryLogic();

console.log("\n--- Test Complete ---");
