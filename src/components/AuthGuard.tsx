'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

const PROTECTED_ROUTES = ['/pantry', '/planner', '/log', '/dashboard', '/analytics', '/coach', '/shopping', '/history', '/profile', '/settings', '/pricing', '/vision'];
const ONBOARDING_ROUTES = ['/login'];
const EXEMPT_ROUTES = ['/about', '/privacy', '/terms'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const checkAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          if (sessionError) console.error("AuthGuard: Session fetch error:", sessionError);
          setAuthorized(false);
          setLoading(false);
          
          // If we are on a route that is NOT login and NOT exempt, redirect to login
          if (pathname !== '/login' && !EXEMPT_ROUTES.some(route => pathname?.startsWith(route))) {
            router.replace('/login');
          } else {
            setAuthorized(true); // Allow login or exempt routes
          }
          return;
        }

        // We have a session, get fresh user data
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
           await supabase.auth.signOut();
           router.replace('/login');
           return;
        }

        const isProtectedRoute = PROTECTED_ROUTES.some(route => 
          pathname?.startsWith(route)
        );

        const isExemptRoute = EXEMPT_ROUTES.some(route =>
          pathname?.startsWith(route)
        );

        if (isProtectedRoute && !session) {
          router.replace('/login');
          setAuthorized(false);
        } else if (session) {
          // If they are on an exempt route, let them through
          if (isExemptRoute) {
            setAuthorized(true);
            setLoading(false);
            return;
          }

          // Check user profile
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('hand_width_mm, metabolic_state_json, plan')
            .eq('id', session.user.id)
            .single();

          if (profileError && profileError.code !== 'PGRST116') {
             console.error("AuthGuard profile fetch error:", profileError);
          }

          // If no profile row exists, we need to create one or at least get them to onboarding
          if (!profile && !pathname.startsWith('/onboarding')) {
             router.replace('/onboarding/profile');
             setAuthorized(false);
             setLoading(false);
             return;
          }

          const metabolic = (profile?.metabolic_state_json || {}) as any;
          const hasProfile = !!(metabolic.age && metabolic.height_cm);
          const hasMedical = !!metabolic.medical_verified;
          const hasCalibration = !!(profile?.hand_width_mm);

          console.log("[AuthGuard] Status Check:", { 
            pathname, 
            hasProfile, 
            hasMedical,
            hasCalibration, 
            plan: profile?.plan,
          });

          // Redirect to onboarding if they haven't started at all
          if (!hasProfile && !pathname.startsWith('/onboarding')) {
             router.replace('/onboarding/profile');
             setAuthorized(false);
             setLoading(false);
             return;
          }

          // If they are on an onboarding page, let them through
          if (pathname.startsWith('/onboarding')) {
            setAuthorized(true);
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (!authorized && !ONBOARDING_ROUTES.some(r => pathname?.startsWith(r)) && !EXEMPT_ROUTES.some(r => pathname?.startsWith(r))) {
    // Prevent rendering children while redirect is in progress
    return null;
  }

  return <>{children}</>;
}
