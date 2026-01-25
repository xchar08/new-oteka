import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { BottomNav } from '@/components/layout/BottomNav';
import { SyncManager } from '@/components/offline/SyncManager';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Oteka',
  description: 'Metabolic Optimization Engine',
  manifest: '/manifest.json',
};

// Next.js 14+ Standard: Viewport is a separate export
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Critical for PWA feel
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
        {/* SyncManager handles Service Worker & Offline Queue listeners */}
        <SyncManager />
        
        {children}
        
        <BottomNav />
      </body>
    </html>
  );
}
