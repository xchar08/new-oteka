import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const env = await load({ envPath: ".env.local" });
const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
const SUPABASE_ANON_KEY = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const SERVICE_ROLE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"]; // May be missing in .env.local

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("❌ Missing Supabase configuration");
    Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnose() {
    console.log("🔍 Diagnosing Scan-to-Log Pipeline...");

    // 1. Check if user is logged in (we need a token to test the edge function)
    // For testing, we might need a test user's credentials or a valid JWT.
    // Since we don't have that easily, we can try to find an existing user.
    const { data: users, error: userErr } = await supabase.from('users').select('id').limit(1);
    
    if (userErr || !users || users.length === 0) {
        console.error("❌ Could not find a user to test with:", userErr);
        return;
    }
    const testUserId = users[0].id;
    console.log(`👤 Found test user: ${testUserId}`);

    // 2. Check current log count
    const { count: initialCount, error: countErr } = await supabase
        .from('logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', testUserId);
    
    console.log(`📊 Initial log count for user: ${initialCount}`);

    // 3. Invoke vision-pipeline (Simulated)
    // We'll call the function directly if we can, but let's first check the code logic.
    console.log("\n🧪 Testing Edge Function Logic (Dry Run)...");
    
    // Simulate the logic in supabase/functions/vision-pipeline/index.ts
    const mode = 'log';
    const finalResult = {
        items: [{ name: "Diagnostic Apple", calories: 95 }],
        macros: { calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
        volume_cm3: 150,
        pantry_items: [] // This is what the AI returns
    };

    console.log("Checking condition: if (mode === 'log' && finalResult && !finalResult.pantry_items)");
    const willLog = (mode === 'log' && finalResult && !finalResult.pantry_items);
    console.log(`Result: ${willLog}`);

    if (!willLog && finalResult.pantry_items) {
        console.log("❌ BUG CONFIRMED: finalResult.pantry_items is truthy (empty array), blocking the log!");
    } else {
        console.log("✅ Logic seems okay if pantry_items was missing.");
    }
}

await diagnose();
