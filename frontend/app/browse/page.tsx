'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { SearchX, Compass } from 'lucide-react';
import { capture } from '@/lib/analytics';
import { useAuth } from '@/components/AuthProvider';
import {
  getCategoryCounts,
  getRecommendations,
  searchRecommendations,
  type CategoryCount,
  type Recommendation,
} from '@/lib/api';
import { SearchHero } from '@/components/SearchHero';
import { CategoryChips } from '@/components/CategoryChips';
import { RecommendationCard } from '@/components/RecommendationCard';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function BrowseInner() {
  const router = useRouter();
  // useSearchParams() is synchronous on the client and reactive to router.push().
  // BrowseInner is only ever rendered client-side (mounted gate in BrowsePage),
  // so no Suspense boundary is needed — it never runs during the static build.
  const params = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const category = params.get('category') ?? '';
  const { signedIn } = useAuth();

  const mode: 'search' | 'browse' | null = q ? 'search' : category ? 'browse' : null;

  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [categoriesError, setCategoriesError] = useState(false);
  const [results, setResults] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Monotonic id so an earlier (slower) fetch can't overwrite a later one's
  // results. Each fetch claims an id; only the latest may touch shared state.
  const reqId = useRef(0);
  // Analytics fire once per distinct (mode, value) so re-renders / dev
  // StrictMode double-invokes never double-count a single search/browse.
  const firedKey = useRef<string | null>(null);

  const refreshCategories = useCallback(() => {
    getCategoryCounts()
      .then((data) => {
        setCategories(data);
        setCategoriesError(false);
      })
      .catch(() => setCategoriesError(true));
  }, []);

  useEffect(() => {
    refreshCategories();
  }, [refreshCategories]);

  // Fetch + analytics are driven by the URL — the navigation *is* the user
  // action, so this is the single place search/browse events fire.
  useEffect(() => {
    if (!mode) {
      setResults([]);
      setLoading(false);
      setError(false);
      return;
    }
    const id = ++reqId.current;
    const key = mode === 'search' ? `q:${q}` : `c:${category}`;
    setLoading(true);
    setError(false);

    const run =
      mode === 'search' ? searchRecommendations(q) : getRecommendations(category);

    run
      .then((data) => {
        if (id !== reqId.current) return; // superseded
        setResults(data);
        if (firedKey.current !== key) {
          firedKey.current = key;
          if (mode === 'search') {
            capture('search', { query: q, category: null, results_count: data.length });
            if (data.length === 0) capture('search_zero_results', { query: q, category: null });
          } else {
            capture('category_browsed', { category });
          }
        }
      })
      .catch(() => {
        if (id !== reqId.current) return;
        setResults([]);
        setError(true);
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
  }, [mode, q, category]);

  const runSearch = useCallback(
    (next: string) => router.push(`/browse?q=${encodeURIComponent(next)}`),
    [router],
  );
  const browseCategory = useCallback(
    (next: string) => router.push(`/browse?category=${encodeURIComponent(next)}`),
    [router],
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <SearchHero
        onSearch={runSearch}
        defaultValue={q}
        className="py-2"
        heading={
          <h1 className="max-w-md text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            Find a trusted local pro your neighbors recommend
          </h1>
        }
      />

      <section className="flex flex-col gap-4">
        {categoriesError ? (
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load categories.{' '}
            <button
              type="button"
              onClick={refreshCategories}
              className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Retry
            </button>
          </p>
        ) : categories.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
        ) : (
          <CategoryChips
            items={categories}
            selected={mode === 'browse' ? category : null}
            onSelect={browseCategory}
          />
        )}

        {mode === 'search' && !loading && !error && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {results.length > 0 ? `Results for “${q}”` : `No matches for “${q}”`}
          </p>
        )}

        {!mode ? (
          <EmptyState
            icon={Compass}
            title="Search or pick a category"
            description="See what your neighbors recommend — search above or tap a category."
          />
        ) : loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={SearchX}
            title="Something went wrong"
            description="We couldn't load recommendations just now."
            action={
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() =>
                  mode === 'search' ? runSearch(q) : browseCategory(category)
                }
              >
                Try again
              </Button>
            }
          />
        ) : results.length > 0 ? (
          <div className="flex flex-col gap-3">
            {results.map((r) => (
              <RecommendationCard key={r.id} rec={r} signedIn={signedIn} />
            ))}
          </div>
        ) : mode === 'search' ? (
          <EmptyState
            icon={SearchX}
            title={`No recommendations for “${q}” yet`}
            description="Try a category above, or be the first to add one."
            action={
              <Button asChild className="rounded-full">
                <Link href="/recommend">Add a recommendation</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={SearchX}
            title={`No recommendations for ${category} yet`}
            description="Be the first to recommend someone in this category."
            action={
              <Button asChild className="rounded-full">
                <Link href="/recommend">Add a recommendation</Link>
              </Button>
            }
          />
        )}
      </section>
    </main>
  );
}

export default function BrowsePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <BrowseFallback />;

  return <BrowseInner />;
}

function BrowseFallback() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <Skeleton className="mx-auto h-12 w-full max-w-xl rounded-full" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
