import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";

const env = await load({ envPath: ".env.local" });
const SUPABASE_ANON_KEY = Deno.env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") || env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const PROJECT_REF = "wnfnyhmqfxtkwsnjdlsv";
const FUNCTION_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/vision-menu`;

console.log("Testing Function:", FUNCTION_URL);

try {
    const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            // Important: We need a valid user JWT to test this. 
            // Using ANON_KEY as a Bearer token will fail getUser(token) because Anon Key is not a user JWT.
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
    });

    console.log("Status:", res.status, res.statusText);
    const text = await res.text();
    console.log("Body:", text);
} catch (e) {
    console.error("Fetch Failed:", e);
}