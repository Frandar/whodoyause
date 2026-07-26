import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://whodoyause.com';

// Static export emits this as /robots.txt at build time.
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/signin' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
