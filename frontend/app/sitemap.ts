import type { MetadataRoute } from 'next';
import { CATEGORIES } from '@/lib/categories';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://whodoyause.com';

export const dynamic = 'force-static';

// Only real, crawlable routes. The per-category URLs are query strings on
// /browse rather than distinct pages (static export), but they are stable,
// shareable and the closest thing this product has to long-tail local entries.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/browse`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/recommend`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    ...CATEGORIES.map((category) => ({
      url: `${SITE_URL}/browse?category=${encodeURIComponent(category)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
