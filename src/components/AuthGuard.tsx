'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

const PROTECTED_ROUTES = ['/pantry', '/planner', '/log', '/dashboard', '/analytics', '/coach', '/shopping', '/history'];
const ONBOARDING_ROUTES = ['/onboarding', '/login'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const checkAuth = async () => {
      // Skip check for onboarding/login routes
      if (ONBOARDING_ROUTES.some(route => pathname?.startsWith(route))) {
        setLoading(false);
        setAuthorized(true);
        return;
      }

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          if (sessionError.message.includes('Refresh Token Not Found') || sessionError.message.includes('invalid refresh token')) {
            console.warn("AuthGuard: Session refresh failed, redirecting to login.");
            router.replace('/login');
            setAuthorized(false);
            setLoading(false);
            return;
          }
          console.error("AuthGuard: Session fetch error:", sessionError);
        }

        const isProtectedRoute = PROTECTED_ROUTES.some(route => 
          pathname?.startsWith(route)
        );

        if (isProtectedRoute && !session) {
          router.replace('/login');
          setAuthorized(false);
        } else if (session) {
          // Check if user has completed onboarding (has hand_width_mm set)
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('hand_width_mm, metabolic_state_json')
            .eq('id', session.user.id)
            .single();

          if (profileError) {
             // PGRST116 is "no rows found", which is fine for new users
             if (profileError.code !== 'PGRST116') {
                console.error("AuthGuard profile fetch error:", profileError);
             }
          }

          const hasProfile = !!(profile?.metabolic_state_json && (profile.metabolic_state_json as any).age);
          const hasCalibration = !!(profile?.hand_width_mm);

          if (!hasProfile || !hasCalibration) {
            // If we are already on onboarding, don't keep replacing (prevents infinite loop in some edge cases)
            if (pathname === '/onboarding' || pathname.startsWith('/onboarding/')) {
               setAuthorized(true);
               setLoading(false);
               return;
            }
            router.replace('/onboarding');
            setAuthorized(false);
            setLoading(false);
            return;
          }
          
          setAuthorized(true);
        } else {
          setAuthorized(true);
        }
      } catch (err) {
        console.error("AuthGuard: Unhandled exception during auth check:", err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, _session: Session | null) => {
        if (event === 'SIGNED_OUT') {
          const isProtectedRoute = PROTECTED_ROUTES.some(route => 
            window.location.pathname.startsWith(route)
          );
          if (isProtectedRoute) router.replace('/login');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
