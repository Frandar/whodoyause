'use client';

import { useEffect, useState } from 'react';
import { getCategoryCounts, type CategoryCount } from '@/lib/api';
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

      <section className="mx-auto w-full max-w-5xl px-4 py-10">
        <div className="mb-6 flex flex-col gap-1 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Every kind of local pro</h2>
          <p className="text-muted-foreground">Pick a category to see who your neighbors recommend.</p>
        </div>
        <CategoryGrid items={categories} />
      </section>

      <CTASection />
      <Footer />
    </>
  );
}
