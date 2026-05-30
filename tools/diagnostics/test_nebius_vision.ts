// scripts/test_nebius_vision.ts
// Run with: deno run --allow-net --allow-read --allow-env scripts/test_nebius_vision.ts

import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";

console.log("🧪 Testing Nebius Qwen-VL Fallback...\n");

// 1. Load Key
let NEBIUS_KEY = Deno.env.get("NEBIUS_API_KEY");
if (!NEBIUS_KEY) {
    try {
        const envFile = await Deno.readTextFile(".env.local");
        const match = envFile.match(/NEBIUS_API_KEY=(.*)/);
        if (match) NEBIUS_KEY = match[1].trim();
    } catch (e) {
        console.error("Could not read .env.local", e);
    }
}

if (!NEBIUS_KEY) {
    console.error("❌ Error: NEBIUS_API_KEY not found.");
    Deno.exit(1);
}

// 2. Define Payload
const FALBACK_PROMPT = "Describe this image in detail. What food is visible?";
// A 100x100 white JPEG image
const MOCK_IMAGE_B64 =
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCABkAGQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1NXW19jZ2uLi5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//9k=";

async function testNebius() {
    const url = "https://api.studio.nebius.ai/v1/chat/completions";

    const payload = {
        model: "Qwen/Qwen2.5-VL-72B-Instruct",
        messages: [
            { role: "system", content: "You are a visual assistant." },
            {
                role: "user",
                content: [
                    { type: "text", text: FALBACK_PROMPT },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${MOCK_IMAGE_B64}`,
                        },
                    },
                ],
            },
        ],
        max_tokens: 100,
    };

    console.log(`Sending request to ${url}...`);
    const start = Date.now();

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${NEBIUS_KEY}`,
            },
            body: JSON.stringify(payload),
        });

        const latency = Date.now() - start;
        console.log(`Latency: ${latency}ms`);
        console.log(`Status: ${res.status} ${res.statusText}`);

        if (res.ok) {
            const data = await res.json();
            const content = data.choices?.[0]?.message?.content;
            console.log("✅ Success! Response:", content);
        } else {
            console.error("❌ Failed:", await res.text());
        }
    } catch (e) {
        console.error("Exception:", e);
    }
}

await testNebius();
