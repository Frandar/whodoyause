'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCategoryCounts, type CategoryCount } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Hero } from '@/components/marketing/Hero';
import { TrustStrip } from '@/components/marketing/TrustStrip';
import { HowItWorks } from '@/components/marketing/HowItWorks';
import { CategoryGrid } from '@/components/CategoryGrid';
import { CTASection } from '@/components/marketing/CTASection';
import { Footer } from '@/components/layout/Footer';
import { CATEGORIES } from '@/lib/categories';

const PLACEHOLDER_CATEGORIES: CategoryCount[] = CATEGORIES.map((category) => ({
  category,
  count: 0,
}));

export default function Home() {
  const [categories, setCategories] = useState<CategoryCount[]>(PLACEHOLDER_CATEGORIES);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    getCategoryCounts()
      .then((data) => {
        setCategories(data);
        setTotal(data.reduce((sum, c) => sum + c.count, 0));
      })
      .catch(() => {
        // Counts are decorative on the landing page — leave placeholders on error.
      });
  }, []);

  return (
    <>
      <Hero />
      <TrustStrip totalRecommendations={total} />
      <HowItWorks />

      <section className="mx-auto w-full max-w-5xl px-4 py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Browse by category
            </p>
            <h2 className="text-balance font-display text-3xl font-extrabold leading-[1.06] tracking-[-0.02em] text-primary sm:text-4xl">
              Every kind of local pro, vouched for nearby.
            </h2>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/browse">See all categories</Link>
          </Button>
        </div>
        <CategoryGrid items={categories} />
      </section>

      <CTASection />
      <Footer />
    </>
  );
}
