import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

let SUPABASE_URL = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
let SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
let SUPABASE_ANON_KEY = Deno.env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY");

try {
    const envFile = await Deno.readTextFile(".env.local");
    
    if (!SUPABASE_URL) {
        const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
        if (urlMatch) SUPABASE_URL = urlMatch[1].trim();
    }

    if (!SUPABASE_SERVICE_KEY) {
        const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
        if (keyMatch) SUPABASE_SERVICE_KEY = keyMatch[1].trim();
    }

    if (!SUPABASE_ANON_KEY) {
        const anonMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
        if (anonMatch) SUPABASE_ANON_KEY = anonMatch[1].trim();
    }
} catch (e) {
    console.error("Could not read .env.local", e);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
  console.error("Missing Supabase credentials");
  Deno.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const userId = "8c34e335-15e2-45ee-9a9b-b704a0cdc913"; // Jeremiah
  console.log("Updating user password...");
  
  // Set password using admin auth
  const { data: userUpdate, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { password: "Password123!", email: "jeremiah@oteka.fit" } // Ensure we have an email too
  );

  if (updateErr) {
    console.error("Failed to update password:", updateErr);
    Deno.exit(1);
  }
  console.log("Password updated successfully for email:", userUpdate.user.email);

  // Now, log in as Jeremiah using public client to get a real user JWT
  const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data: sessionData, error: loginErr } = await supabasePublic.auth.signInWithPassword({
    email: "jeremiah@oteka.fit",
    password: "Password123!"
  });

  if (loginErr || !sessionData.session) {
    console.error("Failed to log in:", loginErr);
    Deno.exit(1);
  }

  const jwt = sessionData.session.access_token;
  console.log("Logged in successfully! JWT obtained.");

  // Test optimize-meals edge function
  console.log("\n--- Testing optimize-meals Edge Function ---");
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/optimize-meals`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${jwt}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        constraints: {
          strictness: true,
          pop_size: 50,
          generations: 30
        }
      })
    });
    console.log("optimize-meals response status:", res.status, res.statusText);
    const bodyText = await res.text();
    console.log("optimize-meals response body:", bodyText);
  } catch (err) {
    console.error("Failed to fetch optimize-meals:", err);
  }

  // Test shopping-generator edge function
  console.log("\n--- Testing shopping-generator Edge Function ---");
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/shopping-generator`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${jwt}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });
    console.log("shopping-generator response status:", res.status, res.statusText);
    const bodyText = await res.text();
    console.log("shopping-generator response body:", bodyText);
  } catch (err) {
    console.error("Failed to fetch shopping-generator:", err);
  }
}

await main();
