import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") || "";

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
