'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SearchHero } from '@/components/SearchHero';
import { Button } from '@/components/ui/button';

export function Hero() {
  const router = useRouter();

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-7 px-4 pt-12 pb-8 sm:pt-20">
      <SearchHero
        onSearch={(q) => router.push(`/browse?q=${encodeURIComponent(q)}`)}
        heading={
          <div className="flex flex-col items-center gap-4">
            <h1 className="max-w-2xl text-balance text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              Find a trusted local pro your neighbors recommend
            </h1>
            <p className="max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
              Stop re-asking the group. Search recommendations from real, named
              community members — and add your own.
            </p>
          </div>
        }
      />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/browse">Browse all categories</Link>
        </Button>
        <Button asChild variant="ghost" className="rounded-full">
          <Link href="/recommend">Recommend a pro</Link>
        </Button>
      </div>
    </section>
  );
}
