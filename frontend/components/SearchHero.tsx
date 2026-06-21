'use client';

import { cn } from '@/lib/utils';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';

export function SearchHero({
  onSearch,
  defaultValue = '',
  heading,
  className,
  autoFocus = false,
}: {
  onSearch: (query: string) => void;
  defaultValue?: string;
  heading?: React.ReactNode;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <section className={cn('flex flex-col items-center gap-5 text-center', className)}>
      {heading === undefined ? (
        <h2 className="max-w-md text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          Find a trusted local pro your neighbors recommend
        </h2>
      ) : (
        heading
      )}
      <SearchAutocomplete
        onSearch={onSearch}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        variant="default"
      />
    </section>
  );
}
