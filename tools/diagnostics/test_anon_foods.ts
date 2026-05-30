import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const envFile = await Deno.readTextFile(".env.local");
let SUPABASE_URL = "";
let SUPABASE_ANON_KEY = "";

const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
if (urlMatch) SUPABASE_URL = urlMatch[1].trim();

const anonMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
if (anonMatch) SUPABASE_ANON_KEY = anonMatch[1].trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const { data: foods, error } = await supabase.from("foods").select("name, metadata_json");
  if (error) {
    console.error("Error fetching foods:", error);
  } else {
    console.log(`Fetched ${foods?.length} foods:`);
    console.log(JSON.stringify(foods, null, 2));
  }
}

await main();
