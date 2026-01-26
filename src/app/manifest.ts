import { MetadataRoute } from 'next';

// This line fixes the build error by forcing static generation
export const dynamic = 'force-static'; 

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Oteka Metabolic',
    short_name: 'Oteka',
    description: 'Volumetric Vision & Entropy Pantry Manager',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    shortcuts: [
      {
        name: "Log Meal",
        url: "/log",
        description: "Open Camera for Vision Log"
      },
      {
        name: "Pantry",
        url: "/pantry",
        description: "Review Inventory"
      }
    ]
  };
}
