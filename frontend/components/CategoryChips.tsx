import { cn } from '@/lib/utils';
import type { CategoryCount } from '@/lib/api';

export function CategoryChips({
  items,
  selected,
  onSelect,
}: {
  items: CategoryCount[];
  selected: string | null;
  onSelect: (category: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ category, count }) => {
        const isSelected = selected === category;
        return (
          <button
            key={category}
            type="button"
            onClick={() => onSelect(category)}
            aria-pressed={isSelected}
            className={cn(
              'rounded-full border-[1.5px] px-[13px] py-[7px] text-[13.5px] font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-[rgb(21_73_63/0.25)] text-primary hover:border-[rgb(21_73_63/0.5)] hover:bg-primary/[0.06]',
            )}
          >
            {category}
            {count > 0 && (
              <span className={cn('ml-1.5 font-semibold', isSelected ? 'opacity-80' : 'text-ink-muted')}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
