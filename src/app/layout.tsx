import type { Metadata, Viewport } from 'next';
import { Syne, Schibsted_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/sonner";
import { ClientProviders } from '@/components/providers/ClientProviders';
import { DebugConsole } from '@/components/ui/DebugConsole';

// Display face — futuristic, high-contrast headlines ("Solar Instrument" voice)
const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '500', '600', '700', '800'],
});

// Body face — characterful grotesk with excellent small-size legibility
const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-schibsted',
});

// Instrument numerals — join codes, readouts, data chips
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jbmono',
  weight: ['400', '600', '700'],
});

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
  themeColor: '#0E0903',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${syne.variable} ${schibsted.variable} ${jetbrains.variable} font-sans bg-[var(--bg-app)]`}>
        <ClientProviders>
          {children}
        </ClientProviders>
        <Toaster
          position="bottom-center"
          expand={false}
          richColors
          toastOptions={{
            style: { bottom: '80px' }
          }}
        />
        <DebugConsole />
      </body>
    </html>
  );
}
