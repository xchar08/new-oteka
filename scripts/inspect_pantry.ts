import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const envFile = await Deno.readTextFile(".env.local");
let SUPABASE_URL = "";
let SUPABASE_SERVICE_KEY = "";

const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
if (urlMatch) SUPABASE_URL = urlMatch[1].trim();

const serviceMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
if (serviceMatch) SUPABASE_SERVICE_KEY = serviceMatch[1].trim();

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  const userId = "8c34e335-15e2-45ee-9a9b-b704a0cdc913"; // Jeremiah
  
  const { data: userObj } = await supabaseAdmin.auth.admin.getUserById(userId);
  console.log("User email:", userObj?.user?.email);

  const { data: pantryItems, error: pErr } = await supabaseAdmin
    .from("pantry")
    .select("*, foods(*)")
    .eq("user_id", userId);

  console.log("\n--- Pantry Items in DB for User ---");
  if (pErr) console.error("Error fetching pantry:", pErr);
  else console.log(JSON.stringify(pantryItems, null, 2));

  const { data: globalFoods, error: fErr } = await supabaseAdmin
    .from("foods")
    .select("*")
    .limit(100);

  console.log("\n--- Global Foods in DB ---");
  if (fErr) console.error("Error fetching foods:", fErr);
  else console.log(`Fetched ${globalFoods?.length} foods`);
}

await main();
