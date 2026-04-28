import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/sonner";
import { ClientProviders } from '@/components/providers/ClientProviders';
import { DebugConsole } from '@/components/ui/DebugConsole';

const inter = Inter({ subsets: ['latin'] });

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
  themeColor: '#292D3E',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} text-white bg-[var(--bg-app)]`}>
        <ClientProviders>
          {children}
        </ClientProviders>
        <Toaster />
        <DebugConsole />
      </body>
    </html>
  );
}
