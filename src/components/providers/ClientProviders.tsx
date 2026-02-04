'use client';

import dynamic from 'next/dynamic';

// These components MUST be loaded only on the client because they use browser APIs
// (navigator, localStorage, etc.) which are not available during static export/SSR.
const SyncManager = dynamic(() => import('@/components/offline/SyncManager').then(m => m.SyncManager), { ssr: false });
const BottomNav = dynamic(() => import('@/components/layout/BottomNav').then(m => m.BottomNav), { ssr: false });
const AuthGuard = dynamic(() => import('@/components/AuthGuard'), { ssr: false });
const AuthLinkHandler = dynamic(() => import('@/components/providers/AuthLinkHandler').then(m => m.AuthLinkHandler), { ssr: false });

export function ClientProviders({ children }: { children: React.ReactNode }) {
    return (
        <AuthLinkHandler>
            <AuthGuard>
                <SyncManager />
                {children}
                <BottomNav />
            </AuthGuard>
        </AuthLinkHandler>
    );
}
