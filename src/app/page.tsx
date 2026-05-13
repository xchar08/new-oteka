'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    };
    checkSession();
  }, [router, supabase]);

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
    </div>
  );
}
