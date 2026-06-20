'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function SearchHero({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) onSearch(q);
  }

  return (
    <section className="flex flex-col items-center gap-5 py-6 text-center sm:py-10">
      <h2 className="max-w-md text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
        Find a trusted local pro your neighbors recommend
      </h2>

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
