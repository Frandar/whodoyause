'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Search, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORIES } from '@/lib/categories';
import { searchRecommendations } from '@/lib/api';
import { Button } from '@/components/ui/button';

// --- types ---

type Suggestion =
  | { kind: 'category'; label: string }
  | { kind: 'business'; label: string; category: string };

// --- helpers ---

function matchingCategories(q: string): Suggestion[] {
  const lower = q.toLowerCase();
  return CATEGORIES.filter((c) => c.toLowerCase().includes(lower))
    .slice(0, 4)
    .map((label) => ({ kind: 'category' as const, label }));
}

function useDebounce(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

// --- shared suggestion dropdown ---

function Suggestions({
  id,
  uid,
  items,
  activeIndex,
  onSelect,
  onHover,
}: {
  id: string;
  uid: string;
  items: Suggestion[];
  activeIndex: number;
  onSelect: (s: Suggestion) => void;
  onHover: (i: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Search suggestions"
      className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-2xl border border-border bg-card py-1.5 shadow-soft-lg"
    >
      {items.map((s, i) => (
        <li
          key={`${s.kind}-${s.label}`}
          id={`${uid}-opt-${i}`}
          role="option"
          aria-selected={i === activeIndex}
          // mousedown fires before blur so the input doesn't lose focus first
          onMouseDown={(e) => { e.preventDefault(); onSelect(s); }}
          onMouseEnter={() => onHover(i)}
          className={cn(
            'flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition-colors',
            i === activeIndex ? 'bg-secondary text-foreground' : 'text-foreground hover:bg-secondary/60',
          )}
        >
          {s.kind === 'category' ? (
            <Tag className="size-3.5 shrink-0 text-primary" aria-hidden />
          ) : (
            <Building2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span className="flex-1 truncate">{s.label}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {s.kind === 'category' ? 'Category' : s.category}
          </span>
        </li>
      ))}
    </ul>
  );
}

// --- shared autocomplete logic (via render prop) ---

type AutocompleteProps = {
  onSearch: (query: string) => void;
  defaultValue?: string;
  placeholder?: string;
  autoFocus?: boolean;
  // 'hero'    — inline white pill (marketing landing)
  // 'default' — standard floating input (browse page)
  variant?: 'hero' | 'default';
  className?: string;
};

export function SearchAutocomplete({
  onSearch,
  defaultValue = '',
  placeholder = 'Search plumbers, electricians, dentists…',
  autoFocus = false,
  variant = 'default',
  className,
}: AutocompleteProps) {
  const router = useRouter();
  const uid = useId();
  const listboxId = `${uid}-listbox`;

  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 250);

  // Keep in sync with URL-driven defaultValue (browse page navigations).
  useEffect(() => setQuery(defaultValue), [defaultValue]);

  // Rebuild suggestions whenever the debounced query changes.
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    // Categories are instant (client-side).
    const cats = matchingCategories(q);
    setSuggestions(cats);
    if (cats.length) setOpen(true);

    // Business names come from the existing search API.
    let stale = false;
    searchRecommendations(q)
      .then((results) => {
        if (stale) return;
        const seen = new Set<string>();
        const businesses: Suggestion[] = [];
        for (const r of results) {
          const key = r.business_name.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            businesses.push({ kind: 'business', label: r.business_name, category: r.category });
          }
          if (businesses.length >= 5) break;
        }
        const all = [...matchingCategories(q), ...businesses];
        setSuggestions(all);
        setOpen(all.length > 0);
      })
      .catch(() => {}); // autocomplete errors are non-critical

    return () => { stale = true; };
  }, [debouncedQuery]);

  // Close on outside click.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  function selectSuggestion(s: Suggestion) {
    setOpen(false);
    setActiveIndex(-1);
    setQuery(s.label);
    if (s.kind === 'category') {
      router.push(`/browse?category=${encodeURIComponent(s.label)}`);
    } else {
      onSearch(s.label);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open || suggestions.length === 0) return;
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open || suggestions.length === 0) return;
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && open) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    setActiveIndex(-1);
    onSearch(q);
  }

  const activeDescendant = activeIndex >= 0 ? `${uid}-opt-${activeIndex}` : undefined;

  const sharedInputProps = {
    ref: inputRef,
    role: 'combobox' as const,
    'aria-expanded': open,
    'aria-controls': listboxId,
    'aria-autocomplete': 'list' as const,
    'aria-activedescendant': activeDescendant,
    'aria-label': 'Search recommendations',
    type: 'search',
    value: query,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onFocus: () => { if (suggestions.length > 0) setOpen(true); },
    maxLength: 100,
    autoFocus,
    autoComplete: 'off',
    placeholder,
  };

  // ─── hero variant: white pill form containing icon + input + button ───
  if (variant === 'hero') {
    return (
      <div ref={containerRef} className={cn('relative w-full max-w-[540px]', className)}>
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 rounded-full bg-white px-5 py-2 shadow-[0_24px_50px_-24px_rgba(0,0,0,0.6)]"
        >
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            {...sharedInputProps}
            className="flex-1 bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <Button type="submit" variant="amber" className="h-9 shrink-0 rounded-full px-5 text-sm">
            Find a pro
          </Button>
        </form>
        <Suggestions
          id={listboxId}
          uid={uid}
          items={open ? suggestions : []}
          activeIndex={activeIndex}
          onSelect={selectSuggestion}
          onHover={setActiveIndex}
        />
      </div>
    );
  }

  // ─── default variant: input + external button side by side ───
  return (
    <div ref={containerRef} className={cn('relative w-full max-w-xl', className)}>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            {...sharedInputProps}
            className="h-12 w-full rounded-full border border-input bg-background py-2 pl-11 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button type="submit" className="h-12 rounded-full px-6">
          Search
        </Button>
      </form>
      <Suggestions
        id={listboxId}
        uid={uid}
        items={open ? suggestions : []}
        activeIndex={activeIndex}
        onSelect={selectSuggestion}
        onHover={setActiveIndex}
      />
    </div>
  );
}
