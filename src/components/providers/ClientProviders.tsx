'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ThemeProvider } from 'next-themes';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

import { useAppStore } from '@/lib/state/appStore';

// These components MUST be loaded only on the client because they use browser APIs
// (navigator, localStorage, etc.) which are not available during static export/SSR.
const BottomNav = dynamic(() => import('@/components/layout/BottomNav').then(m => m.BottomNav), { ssr: false });
const AuthGuard = dynamic(() => import('@/components/AuthGuard'), { ssr: false });
const AuthLinkHandler = dynamic(() => import('@/components/providers/AuthLinkHandler').then(m => m.AuthLinkHandler), { ssr: false });

function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const colorTheme = useAppStore((s) => s.colorTheme);
  
  useEffect(() => {
    const root = document.documentElement;
    // Remove existing theme classes
    root.classList.remove('theme-solar', 'theme-emerald', 'theme-cobalt', 'theme-midnight');
    // Add new theme class
    root.classList.add(`theme-${colorTheme}`);
  }, [colorTheme]);

  return (
    <div className="min-h-screen transition-colors duration-500 bg-[var(--bg-app)] text-[var(--text-primary)]">
      {children}
    </div>
  );
}

export function ClientProviders({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
                <AuthLinkHandler>
                    <AuthGuard>
                        <ThemeWrapper>
                            {children}
                            <BottomNav />
                        </ThemeWrapper>
                    </AuthGuard>
                </AuthLinkHandler>
            </ThemeProvider>
        </QueryClientProvider>
    );
}
