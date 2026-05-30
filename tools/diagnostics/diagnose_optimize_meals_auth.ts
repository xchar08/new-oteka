import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";

const envFile = await fs.readFile(".env.local", "utf8");
let SUPABASE_URL = "";
let SUPABASE_SERVICE_KEY = "";
let SUPABASE_ANON_KEY = "";

const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
if (urlMatch) SUPABASE_URL = urlMatch[1].trim();

const serviceMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
if (serviceMatch) SUPABASE_SERVICE_KEY = serviceMatch[1].trim();

const anonMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
if (anonMatch) SUPABASE_ANON_KEY = anonMatch[1].trim();

const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnose() {
  console.log("Logging in Jeremiah...");
  const { data: sessionData, error: loginErr } = await supabasePublic.auth
    .signInWithPassword({
      email: "jeremiah@oteka.fit",
      password: "Password123!",
    });

  if (loginErr || !sessionData.session) {
    console.error("Login failed:", loginErr);
    return;
  }

  const jwt = sessionData.session.access_token;
  const authHeader = `Bearer ${jwt}`;

  console.log(
    "\n1. Testing createClient with global headers (simulate current edge function)...",
  );
  try {
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log("User:", user?.email);
    console.log("User Error:", userError);
  } catch (err) {
    console.error("Crash during method 1:", err);
  }

  console.log("\n2. Testing getUser(token) directly by extracting JWT...");
  try {
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
    );

    const token = jwt; // or authHeader.replace("Bearer ", "")
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      token,
    );
    console.log("User:", user?.email);
    console.log("User Error:", userError);
  } catch (err) {
    console.error("Crash during method 2:", err);
  }
}

await diagnose();
