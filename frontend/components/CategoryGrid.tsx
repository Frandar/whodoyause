import Link from 'next/link';
import {
  Snowflake,
  Zap,
  Droplet,
  Sprout,
  Smile,
  HardHat,
  Home,
  Bug,
  Sparkles,
  Car,
  Paintbrush,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryCount } from '@/lib/api';

// Each seed category gets a glyph so the grid reads at a glance (design file
// "Browse by category"). Falls back to a generic tool icon for anything new.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  HVAC: Snowflake,
  Electrician: Zap,
  Plumber: Droplet,
  'Lawn/Landscaping': Sprout,
  Dentist: Smile,
  'General Contractor': HardHat,
  Roofing: Home,
  'Pest Control': Bug,
  'House Cleaning': Sparkles,
  'Auto Repair': Car,
  Painter: Paintbrush,
  Handyman: Wrench,
};

export function CategoryGrid({ items }: { items: CategoryCount[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map(({ category, count }) => {
        const Icon = CATEGORY_ICONS[category] ?? Wrench;
        return (
          <li key={category}>
            <Link
              href={`/browse?category=${encodeURIComponent(category)}`}
              className="group flex h-full flex-col rounded-[var(--radius)] border border-border bg-card p-5 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="size-6" aria-hidden />
              </span>
              <span className="mt-4 font-semibold leading-tight">{category}</span>
              <span className="mt-1 text-xs text-muted-foreground">
                {count > 0
                  ? `${count} recommendation${count === 1 ? '' : 's'}`
                  : 'Be the first'}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
