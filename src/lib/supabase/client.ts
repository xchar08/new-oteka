import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("CRITICAL ERROR: Supabase environment variables are missing.");
    console.error("The app will likely fail to fetch data. Please check your build environment / .env.local file.");
    
    // Return a dummy client that will fail gracefully with clear errors instead of crashing the whole React tree
    return createBrowserClient(
      'https://placeholder-url.supabase.co',
      'placeholder-key'
    );
  }

  return createBrowserClient(
    url,
    key
  );
}
