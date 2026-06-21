'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import { CATEGORIES } from '@/lib/categories';

const HERO_CATEGORIES = CATEGORIES.slice(0, 8);

export function Hero() {
  const router = useRouter();

  return (
    <section className="bg-primary">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 pb-14 pt-14 text-center sm:pb-20 sm:pt-20">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3.5 py-1.5 text-[13.5px] font-semibold text-white/90">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          Recommended by your neighbors, not algorithms
        </div>

        {/* Headline */}
        <h1 className="text-balance text-[clamp(2.25rem,6vw,4rem)] font-extrabold leading-[1.02] tracking-[-0.025em] text-white">
          Good help, recommended<br className="hidden sm:block" /> by the people next door.
        </h1>

        {/* Sub-headline */}
        <p className="max-w-[520px] text-balance text-[clamp(1rem,1.5vw,1.2rem)] leading-relaxed text-white/70">
          Skip the gamble of anonymous reviews. WhoDoYaUse surfaces the HVAC techs, lawn crews,
          plumbers and pros your actual neighbors recommend — by name.
        </p>

        {/* Search bar with autocomplete */}
        <SearchAutocomplete
          variant="hero"
          onSearch={(q) => router.push(`/browse?q=${encodeURIComponent(q)}`)}
        />

        {/* Category chips */}
        <div className="flex flex-wrap justify-center gap-2">
          {HERO_CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={`/browse?category=${encodeURIComponent(cat)}`}
              className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white/85 transition-colors hover:bg-white/18 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              {cat}
            </Link>
          ))}
        </div>

        {/* Trust line */}
        <p className="text-xs text-white/45">
          Free to use · No spam · Real neighbors only
        </p>
      </div>
    </section>
  );
}
