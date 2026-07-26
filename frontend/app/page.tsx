'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCategoryCounts, type CategoryCount } from '@/lib/api';
import { Hero } from '@/components/marketing/Hero';
import { RevealObserver } from '@/components/RevealObserver';
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
  const [covered, setCovered] = useState(0);

  useEffect(() => {
    getCategoryCounts()
      .then((data) => {
        setCategories(data);
        setTotal(data.reduce((sum, c) => sum + c.count, 0));
        setCovered(data.filter((c) => c.count > 0).length);
      })
      .catch(() => {
        // Counts are decorative on the landing page — leave placeholders on error.
      });
  }, []);

  return (
    <>
      <RevealObserver />
      <Hero />
      <TrustStrip totalRecommendations={total} categoriesCovered={covered} />
      <HowItWorks />

      {/* Browse-by-category band from the design reference (#categories section). */}
      <section id="categories" className="scroll-mt-24 bg-surface-raised px-6 py-[clamp(64px,8vw,112px)]">
        <div className="mx-auto w-full max-w-[1200px]">
          <div
            data-reveal
            className="mb-[46px] flex flex-wrap items-end justify-between gap-5"
          >
            <div className="max-w-[560px]">
              <p className="mb-3.5 text-[13.5px] font-bold uppercase tracking-[0.08em] text-ink-eyebrow">
                Browse by category
              </p>
              <h2 className="text-balance font-display text-[clamp(30px,4vw,46px)] font-extrabold leading-[1.06] tracking-[-0.02em] text-primary">
                Every kind of local pro, vouched for nearby.
              </h2>
            </div>
            <Link
              href="/browse"
              className="rounded-full border-[1.5px] border-primary/25 px-[22px] py-3 text-[15px] font-bold text-primary transition-colors duration-[250ms] hover:border-primary/50 hover:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              See all categories
            </Link>
          </div>
          <CategoryGrid items={categories} />
        </div>
      </section>

      <CTASection />
      <Footer />
    </>
  );
}
