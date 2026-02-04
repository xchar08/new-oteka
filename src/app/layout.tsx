import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import dynamic from 'next/dynamic';

const inter = Inter({ subsets: ['latin'] });

import { ClientProviders } from '@/components/providers/ClientProviders';

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
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
