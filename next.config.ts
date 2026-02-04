import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // <--- REQUIRED for Capacitor
  reactStrictMode: true,
  images: {
    unoptimized: true, // <--- REQUIRED because static export cannot run image optimization server
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  // 'headers()' are technically ignored in static export (served by Nginx/Vercel usually), 
  // but keeping it here doesn't hurt build. Capacitor ignores it.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
