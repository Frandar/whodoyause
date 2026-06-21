'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function SearchHero({
  onSearch,
  defaultValue = '',
  heading,
  className,
  autoFocus = false,
}: {
  onSearch: (query: string) => void;
  defaultValue?: string;
  // Pass a node to override the default headline, or `null` to hide it.
  heading?: React.ReactNode;
  className?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState(defaultValue);

  // Resync when navigation changes the seeded value (e.g. /browse?q=…).
  useEffect(() => setQuery(defaultValue), [defaultValue]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) onSearch(q);
  }

  return (
    <section className={cn('flex flex-col items-center gap-5 text-center', className)}>
      {heading === undefined ? (
        <h2 className="max-w-md text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          Find a trusted local pro your neighbors recommend
        </h2>
      ) : (
        heading
      )}

      <form onSubmit={submit} className="flex w-full max-w-xl items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={100}
            autoFocus={autoFocus}
            aria-label="Search recommendations"
            placeholder="Search plumbers, electricians, dentists…"
            className="h-12 rounded-full pl-11 text-base"
          />
        </div>
        <Button type="submit" className="h-12 rounded-full px-6">
          Search
        </Button>
      </form>
    </section>
  );
}
