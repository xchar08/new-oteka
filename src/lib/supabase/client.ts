import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("SUPABASE CONFIG ERROR: URL or Key is undefined in the environment.");
  }

  return createBrowserClient(
    url!,
    key!
  );
}
