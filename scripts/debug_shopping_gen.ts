// scripts/debug_shopping_gen.ts
// Run: deno run --allow-net --allow-read --allow-env scripts/debug_shopping_gen.ts

import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";

console.log("🛒 Debugging Shopping Generator Logic...\n");

// 1. Load Keys
let NEBIUS_KEY = Deno.env.get("NEBIUS_API_KEY");
let GEMINI_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");

if (!NEBIUS_KEY || !GEMINI_KEY) {
    try {
        const envFile = await Deno.readTextFile(".env.local");
        const nMatch = envFile.match(/NEBIUS_API_KEY=(.*)/);
        if (nMatch) NEBIUS_KEY = nMatch[1].trim();

        const gMatch = envFile.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.*)/);
        if (gMatch) GEMINI_KEY = gMatch[1].trim();
    } catch (e) {
        console.error("Could not read .env.local", e);
    }
}

console.log(`🔑 Keys Loaded? Nebius: ${!!NEBIUS_KEY}, Gemini: ${!!GEMINI_KEY}`);

const systemPrompt = `
Task: Generate a shopping list for 3 days of optimal eating.
Return ONLY JSON wrapped in markdown code blocks:
\`\`\`json
{
"suggestions": [
    { "name": "Item", "category": "Produce", "reason": "Test", "priority": "high" }
]
}
\`\`\`
`;

async function testGemini() {
    if (!GEMINI_KEY) return;
    console.log("\n[TEST] 1. Gemini 2.5 Flash...");
    try {
        const url =
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
        const start = Date.now();
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: { responseMimeType: "text/plain" }, // Request text to allow markdown
            }),
        });
        const latency = Date.now() - start;
        console.log(`Latency: ${latency}ms, Status: ${res.status}`);

        if (res.ok) {
            const data = await res.json();
            let txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
            console.log("Raw Output:", txt?.substring(0, 50) + "...");

            if (txt) {
                // SIMULATE THE FIX: Clean Markdown
                const jsonMatch = txt.match(/```json\n([\s\S]*?)\n```/) ||
                    txt.match(/```([\s\S]*?)```/);
                if (jsonMatch) {
                    console.log("🔧 Markdown Detected & Stripped");
                    txt = jsonMatch[1];
                }

                try {
                    const json = JSON.parse(txt);
                    console.log(
                        "✅ JSON Parsed Successfully:",
                        json.suggestions[0].name,
                    );
                    return true;
                } catch (e) {
                    console.error("❌ JSON Parse Failed:", e);
                    return false;
                }
            }
            return false;
        } else {
            console.error("❌ Gemini Failed:", await res.text());
            return false;
        }
    } catch (e) {
        console.error("❌ Gemini Exception:", e);
        return false;
    }
}

async function testNebius() {
    if (!NEBIUS_KEY) return;
    console.log("\n[TEST] 2. Nebius DeepSeek R1...");
    try {
        const url = "https://api.studio.nebius.ai/v1/chat/completions";
        const start = Date.now();
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${NEBIUS_KEY}`,
            },
            body: JSON.stringify({
                model: "deepseek-ai/DeepSeek-R1-0528", // Verify model ID
                messages: [
                    {
                        role: "system",
                        content: "You are a JSON-only assistant.",
                    },
                    { role: "user", content: systemPrompt },
                ],
                max_tokens: 1000,
            }),
        });
        const latency = Date.now() - start;
        console.log(`Latency: ${latency}ms, Status: ${res.status}`);

        if (res.ok) {
            const data = await res.json();
            const content = data.choices?.[0]?.message?.content;
            console.log("✅ Nebius Response:", content?.substring(0, 200));
            return true;
        } else {
            console.error("❌ Nebius Failed:", await res.text());
            return false;
        }
    } catch (e) {
        console.error("❌ Nebius Exception:", e);
        return false;
    }
}

await testGemini();
await testNebius();
