import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";

// Load env vars
const env = await load({ envPath: ".env.local" });
const SUPABASE_URL = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ||
    env["NEXT_PUBLIC_SUPABASE_URL"];
const SUPABASE_ANON_KEY = Deno.env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("❌ Missing Supabase URL or Anon Key");
    Deno.exit(1);
}

const PROJECT_REF = "wnfnyhmqfxtkwsnjdlsv"; // From deploy logs
const FUNCTION_URL =
    `https://${PROJECT_REF}.supabase.co/functions/v1/shopping-generator`;

console.log(`Testing Function: ${FUNCTION_URL}`);

try {
    const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
    });

    console.log(`\nStatus: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log("Body:", text.substring(0, 500)); // Print first 500 chars

    try {
        const json = JSON.parse(text);
        console.log("\n✅ Valid JSON Response");
        if (json.failure) {
            console.log("⚠️ Application Failure:", json.error);
        }
    } catch {
        console.log("\n⚠️ Response is NOT JSON");
    }
} catch (e) {
    console.error("\n❌ Fetch Failed:", e);
}
