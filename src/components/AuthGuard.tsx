'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client'; // ✅ Fixed path
import { AuthChangeEvent, Session } from '@supabase/supabase-js'; // ✅ Added types

const PROTECTED_ROUTES = ['/pantry', '/planner', '/log', '/dashboard'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      // Check if current route requires auth
      const isProtectedRoute = PROTECTED_ROUTES.some(route => 
        pathname?.startsWith(route)
      );

      if (isProtectedRoute && !session) {
        // Not logged in -> Redirect to login
        router.replace('/login');
        setAuthorized(false);
      } else {
        // Logged in OR public route -> Allow
        setAuthorized(true);
      }
      
      setLoading(false);
    };

    checkAuth();
    
    // Listen for auth state changes (e.g. sign out)
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
    // Optional: Render a loading spinner while checking auth
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  // Only render children if on a public route or authorized
  return <>{children}</>;
}
