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
              'rounded-full border px-3 py-1.5 text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted',
            )}
          >
            {category}
            {count > 0 && (
              <span className={cn('ml-1.5', isSelected ? 'opacity-80' : 'text-muted-foreground')}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
