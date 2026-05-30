import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const envFile = await Deno.readTextFile(".env.local");
let SUPABASE_URL = "";
let SUPABASE_SERVICE_KEY = "";

const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
if (urlMatch) SUPABASE_URL = urlMatch[1].trim();

const serviceMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
if (serviceMatch) SUPABASE_SERVICE_KEY = serviceMatch[1].trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });
  if (res.ok) {
    const swagger = await res.json();
    const foodsDef = swagger.definitions?.foods;
    console.log("foods definition:", JSON.stringify(foodsDef, null, 2));
  } else {
    console.error("Failed to fetch schema", res.status, await res.text());
  }
}

await main();
