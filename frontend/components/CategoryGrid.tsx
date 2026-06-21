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
            className="group flex h-full items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex flex-col">
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
