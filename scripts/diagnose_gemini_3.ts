// scripts/diagnose_gemini_3.ts
// Run with: deno run --allow-net --allow-env scripts/diagnose_gemini_3.ts

import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";

console.log("🔍 Diagnosing Gemini 3.0 Flash Preview Availability...\n");

// Manually parse .env.local
let API_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");

if (!API_KEY) {
    try {
        const envFile = await Deno.readTextFile(".env.local");
        const match = envFile.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.*)/);
        if (match) API_KEY = match[1].trim();
    } catch (e) {
        console.error("Could not read .env.local", e);
    }
}

if (!API_KEY) {
    console.error(
        "❌ Error: GOOGLE_GENERATIVE_AI_API_KEY not found in environment or .env.local",
    );
    Deno.exit(1);
}

const MODELS_TO_TEST = [
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash"
];

async function testModel(model: string) {
    console.log(`\n--- Testing Model: ${model} ---`);
    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    const payload = {
        contents: [{ parts: [{ text: "Hello, confirm you are working." }] }],
    };

    const start = Date.now();
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const latency = Date.now() - start;

        console.log(`Status: ${res.status} ${res.statusText}`);
        console.log(`Latency: ${latency}ms`);

        if (res.ok) {
            console.log("✅ Response Success!");
        } else {
            console.log("❌ Response Error Body:", await res.text());
        }
    } catch (e) {
        console.error("Example Exception:", e);
    }
}

for (const model of MODELS_TO_TEST) {
    await testModel(model);
}
