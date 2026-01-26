import { MetadataRoute } from 'next'

export const dynamic = 'force-static'; // <--- ADD THIS
 
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/private/',
    },
    sitemap: 'https://oteka.app/sitemap.xml',
  }
}
