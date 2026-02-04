import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import dynamic from 'next/dynamic';

const inter = Inter({ subsets: ['latin'] });

// Headless and client-heavy components should be dynamic with SSR disabled
const SyncManager = dynamic(() => import('@/components/offline/SyncManager').then(m => m.SyncManager), { ssr: false });
const BottomNav = dynamic(() => import('@/components/layout/BottomNav').then(m => m.BottomNav), { ssr: false });
const AuthGuard = dynamic(() => import('@/components/AuthGuard'), { ssr: false });

export const metadata: Metadata = {
  title: 'Oteka',
  description: 'Metabolic Optimization Engine',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50`}>
        <AuthGuard>
          <SyncManager />
          {children}
          <BottomNav />
        </AuthGuard>
      </body>
    </html>
  );
}
