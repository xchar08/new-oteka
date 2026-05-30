'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useAppStore } from '@/lib/state/appStore';
import { UserProfile, MetabolicState } from '@/lib/types/metabolic';

const PROTECTED_ROUTES = ['/pantry', '/log', '/dashboard', '/analytics', '/coach', '/shopping', '/history', '/profile', '/settings', '/pricing', '/vision', '/social'];
const PREMIUM_ROUTES = ['/analytics', '/coach', '/travel/menu', '/shopping'];
const ONBOARDING_ROUTES = ['/login'];
const EXEMPT_ROUTES = ['/about', '/privacy', '/terms'];

/**
 * Global Authorization Guard
 * Enforces:
 * 1. Authentication
 * 2. Sequential Onboarding (Profile -> Medical -> Calibration)
 * 3. Pro-tier Route Protection
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const setPlan = useAppStore(s => s.setPlan);

  const checkAuth = useCallback(async () => {
    const supabase = createClient();
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      const isPremiumRoute = PREMIUM_ROUTES.some(route => pathname === route || pathname?.startsWith(`${route}/`));
      const isExemptRoute = EXEMPT_ROUTES.some(route => pathname?.startsWith(route));
      const isOnboardingRoute = pathname.startsWith('/onboarding');

      if (session) {
        if (isExemptRoute) {
          setAuthorized(true);
          setLoading(false);
          return;
        }

        // FETCH USER PROFILE & PLAN
        const { data: profile } = await supabase
          .from('users')
          .select('id, hand_width_mm, metabolic_state_json, plan')
          .eq('id', session.user.id)
          .single();

        const userProfile = profile as any as UserProfile; // Cast to profile for safety
        const currentPlan = userProfile?.plan || 'free';
        const isPro = currentPlan === 'pro';

        // Sync plan with global store
        setPlan(currentPlan === 'pro' ? 'pro' : 'free');

        // 1. PROTECT PREMIUM ROUTES
        if (isPremiumRoute && !isPro) {
          console.warn("[AuthGuard] Premium route denied. Redirecting to pricing.");
          router.replace('/pricing');
          setAuthorized(false);
          setLoading(false);
          return;
        }

        const metabolic = (userProfile?.metabolic_state_json || {}) as MetabolicState;
        const hasProfile = !!(metabolic.age && metabolic.height_cm);
        const hasMedical = !!metabolic.medical_verified;
        const hasCalibration = !!(userProfile?.hand_width_mm);
        const hasTaste = !!(userProfile?.taste_profile_json && userProfile.taste_profile_json.confidence > 0);

        if (isOnboardingRoute) {
          setAuthorized(true);
          setLoading(false);
          return;
        }

        // 2. ENFORCE SEQUENTIAL ONBOARDING
        if (!hasProfile && pathname !== '/onboarding/profile') {
          router.replace('/onboarding/profile');
          setAuthorized(false);
        } else if (hasProfile && !hasMedical && pathname !== '/onboarding/medical') {
          router.replace('/onboarding/medical');
          setAuthorized(false);
        } else if (hasProfile && hasMedical && !hasCalibration && pathname !== '/onboarding/calibration') {
          router.replace('/onboarding/calibration');
          setAuthorized(false);
        } else if (hasProfile && hasMedical && hasCalibration && !hasTaste && pathname !== '/onboarding/taste') {
          router.replace('/onboarding/taste');
          setAuthorized(false);
        } else {
          setAuthorized(true);
        }
      } else {
        const isExempt = EXEMPT_ROUTES.some(r => pathname?.startsWith(r)) || pathname === '/login' || pathname?.startsWith('/onboarding');
        if (!isExempt) {
          router.replace('/login');
          setAuthorized(false);
        } else {
          setAuthorized(true);
        }
      }
    } catch (err) {
      console.error("AuthGuard critical error:", err);
    } finally {
      setLoading(false);
    }
  }, [pathname, router, setPlan]);

  useEffect(() => {
    const supabase = createClient();
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
  }, [checkAuth, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  // Final Gate
  if (!authorized && 
      !pathname.startsWith('/onboarding') && 
      pathname !== '/login' && 
      !EXEMPT_ROUTES.some(r => pathname?.startsWith(r))) {
    return null;
  }

  return <>{children}</>;
}
