'use client';

import { useEffect } from 'react';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function AuthLinkHandler({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // 1. Handle deep links for Android/iOS
    const setupDeepLinkListener = async () => {
      App.addListener('appUrlOpen', async (event: URLOpenListenerEvent) => {
        const url = new URL(event.url);
        
        // Supabase sends tokens in the fragment (#) for magic links/OAuth
        const hash = url.hash;
        if (hash && hash.includes('access_token=')) {
          // Extract tokens from hash
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (!error) {
              router.push('/dashboard');
            } else {
              console.error('Auth Link Error:', error.message);
            }
          }
        }
        
        // Also handle 'code' based flows if PKCE is used
        const code = url.searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            router.push('/dashboard');
          } else {
            console.error('Auth Code Error:', error.message);
          }
        }
      });
    };

    setupDeepLinkListener();

    return () => {
      App.removeAllListeners();
    };
  }, [router, supabase]);

  return <>{children}</>;
}
