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
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-[18px]">
      {items.map(({ category, count }, i) => {
        const Icon = CATEGORY_ICONS[category] ?? Wrench;
        return (
          <li key={category} data-reveal data-reveal-delay={(i % 4) * 60} className="h-full">
            <Link
              href={`/browse?category=${encodeURIComponent(category)}`}
              className="flex h-full flex-col rounded-[var(--radius)] border border-[rgb(20_40_30/0.08)] bg-background p-6 transition-[translate,box-shadow] duration-[350ms] hover:-translate-y-1.5 hover:shadow-[0_24px_40px_-26px_rgb(8_30_22/0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-[52px] items-center justify-center rounded-[15px] bg-secondary text-primary">
                <Icon className="size-6" strokeWidth={1.8} aria-hidden />
              </span>
              <span className="mt-4 text-[16.5px] font-bold leading-tight text-foreground">
                {category}
              </span>
              <span className="mt-[3px] text-[13.5px] text-ink-muted">
                {count > 0 ? `${count} pro${count === 1 ? '' : 's'} nearby` : 'Be the first'}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
