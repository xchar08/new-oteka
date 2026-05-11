'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useAppStore } from '@/lib/state/appStore';
import dynamic from 'next/dynamic';

const PROTECTED_ROUTES = ['/pantry', '/planner', '/log', '/dashboard', '/analytics', '/coach', '/shopping', '/history', '/profile', '/settings', '/pricing', '/vision'];
const PREMIUM_ROUTES = ['/planner', '/analytics', '/coach', '/travel/menu', '/shopping'];
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
          setAuthorized(false);
          setLoading(false);
          
          if (pathname !== '/login' && !EXEMPT_ROUTES.some(route => pathname?.startsWith(route))) {
            router.replace('/login');
          } else {
            setAuthorized(true);
          }
          return;
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
           await supabase.auth.signOut();
           router.replace('/login');
           return;
        }

        const isPremiumRoute = PREMIUM_ROUTES.some(route => 
          pathname === route || 
          pathname?.startsWith(`${route}/`)
        );
        
        const isProtectedRoute = PROTECTED_ROUTES.some(route => 
          pathname === route || 
          pathname?.startsWith(`${route}/`)
        );
        
        const isExemptRoute = EXEMPT_ROUTES.some(route => pathname?.startsWith(route));
        const isOnboardingRoute = pathname.startsWith('/onboarding');

        if (session) {
          if (isExemptRoute) {
            setAuthorized(true);
            setLoading(false);
            return;
          }

          const { data: profile } = await supabase
            .from('users')
            .select('hand_width_mm, metabolic_state_json, plan')
            .eq('id', session.user.id)
            .single();

          const currentPlan = profile?.plan || 'free';
          const isPro = currentPlan === 'pro' || currentPlan === 'premium';

          if (isPremiumRoute && !isPro) {
            router.replace('/pricing');
            setAuthorized(false);
            setLoading(false);
            return;
          }

          const metabolic = (profile?.metabolic_state_json || {}) as any;
          const hasProfile = !!(metabolic.age && metabolic.height_cm);
          const hasMedical = !!metabolic.medical_verified;
          const hasCalibration = !!(profile?.hand_width_mm);

          if (isOnboardingRoute) {
            setAuthorized(true);
            setLoading(false);
            return;
          }

          if (!hasProfile && pathname !== '/onboarding/profile') {
            router.replace('/onboarding/profile');
            setAuthorized(false);
          } else if (hasProfile && !hasMedical && pathname !== '/onboarding/medical') {
            router.replace('/onboarding/medical');
            setAuthorized(false);
          } else if (hasProfile && hasMedical && !hasCalibration && pathname !== '/onboarding/calibration') {
            router.replace('/onboarding/calibration');
            setAuthorized(false);
          } else {
            setAuthorized(true);
          }
        } else {
          setAuthorized(true);
        }
      } catch (err) {
        console.error("AuthGuard Exception:", err);
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, _session: Session | null) => {
        if (event === 'SIGNED_OUT') {
          router.replace('/login');
        } else if (event === 'SIGNED_IN') {
          checkAuth();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  // Prevent unauthorized access during redirect
  if (!authorized && 
      !pathname.startsWith('/onboarding') && 
      pathname !== '/login' && 
      !EXEMPT_ROUTES.some(r => pathname?.startsWith(r))) {
    return null;
  }

  return <>{children}</>;
}
