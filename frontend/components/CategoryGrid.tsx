import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { CategoryCount } from '@/lib/api';

export function CategoryGrid({ items }: { items: CategoryCount[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map(({ category, count }) => (
        <li key={category}>
          <Link
            href={`/browse?category=${encodeURIComponent(category)}`}
            className="group flex h-full items-center justify-between gap-2 rounded-[var(--radius)] border border-border bg-background p-5 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex flex-col gap-1">
              <span className="font-semibold leading-tight">{category}</span>
              <span className="text-xs text-muted-foreground">
                {count > 0
                  ? `${count} recommendation${count === 1 ? '' : 's'}`
                  : 'Be the first'}
              </span>
            </span>
            <ArrowUpRight
              className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
