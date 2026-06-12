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
};

export default nextConfig;
