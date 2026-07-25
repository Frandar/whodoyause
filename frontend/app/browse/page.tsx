'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SearchX, Compass, Plus } from 'lucide-react';
import { capture } from '@/lib/analytics';
import { useAuth } from '@/components/AuthProvider';
import {
  getCategoryCounts,
  getRecommendations,
  searchRecommendations,
  type CategoryCount,
  type Recommendation,
} from '@/lib/api';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import { CategoryChips } from '@/components/CategoryChips';
import { RecommendationCard } from '@/components/RecommendationCard';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type Params = { q: string; category: string };

function readParams(): Params {
  if (typeof window === 'undefined') return { q: '', category: '' };
  const sp = new URLSearchParams(window.location.search);
  return { q: sp.get('q')?.trim() ?? '', category: sp.get('category') ?? '' };
}

// The green brand band: shared links land here, so the product surface —
// not just the marketing page — must carry the WhoDoYaUse identity.
function BrowseHeroBand({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-primary">
      {/* Radial glow from the reference hero/pros bands. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[120px] -top-[120px] size-[460px] rounded-full bg-[radial-gradient(circle_at_center,rgb(255_255_255/0.08),transparent_65%)]"
      />
      <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-4 py-10 text-center sm:py-14">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/[0.16] bg-white/[0.12] py-[7px] pl-[11px] pr-3.5 text-[13.5px] font-semibold text-[#eaf3ee]">
          <span className="text-sm text-amber" aria-hidden>
            ★
          </span>
          Recommended by your neighbors, not algorithms
        </p>
        <h1 className="max-w-xl text-balance text-[clamp(1.75rem,4.5vw,2.5rem)] font-extrabold leading-[1.05] tracking-[-0.025em] text-white">
          Find a trusted local pro your <span className="text-amber">neighbors</span> recommend
        </h1>
        {children}
      </div>
    </div>
  );
}

// Closes the list with an invitation to contribute — the supply side of the
// product. When browsing a category we carry it into the form so recommending
// another pro in that category is one tap. Sits below the cards so it never
// competes with reading existing recommendations.
function RecommendMoreCta({ category }: { category: string }) {
  const href = category
    ? `/recommend?category=${encodeURIComponent(category)}`
    : '/recommend';
  return (
    <div className="mt-1 flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-[#c7dccf] bg-[#f6faf5] px-5 py-6 text-center">
      <p className="text-[14.5px] font-semibold text-[#15493f]">
        {category ? `Know another great ${category}?` : 'Know a pro worth recommending?'}
      </p>
      <Button asChild className="rounded-full">
        <Link href={href}>
          <Plus className="size-4" aria-hidden />
          Recommend a pro
        </Link>
      </Button>
    </div>
  );
}

function BrowseInner() {
  // Query params are managed locally via the History API, NOT the Next.js router.
  // In a static export (`output: 'export'`), router.push() to the same path with a
  // different query string is a silent no-op — query strings don't define separate
  // routes — which froze every search/category interaction after a hard page load.
  // window.history.pushState + a popstate listener gives correct, shareable,
  // back-button-friendly URLs that always trigger a re-render.
  const [{ q, category }, setParams] = useState<Params>(readParams);
  const { signedIn } = useAuth();

  const navigate = useCallback((search: string) => {
    const url = search ? `/browse?${search}` : '/browse';
    // Re-submitting the current query must not stack duplicate history entries
    // (Back would walk through repeats) — replace instead of push when unchanged.
    if (window.location.pathname + window.location.search === url) {
      window.history.replaceState(null, '', url);
    } else {
      window.history.pushState(null, '', url);
    }
    setParams(readParams());
  }, []);

  // Keep state in sync with browser back/forward.
  useEffect(() => {
    const onPop = () => setParams(readParams());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const mode: 'search' | 'browse' | null = q ? 'search' : category ? 'browse' : null;

  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [categoriesError, setCategoriesError] = useState(false);
  const [results, setResults] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // Bumping this re-runs the fetch effect with unchanged params — the "Try
  // again" path. (Params are primitives in the dep array, so re-navigating to
  // the same query alone would never refetch.)
  const [retryTick, setRetryTick] = useState(0);
  const retry = useCallback(() => setRetryTick((t) => t + 1), []);

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

  // Fetch + analytics are driven by the current params — the navigation *is* the
  // user action, so this is the single place search/browse events fire.
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
  }, [mode, q, category, retryTick]);

  const runSearch = useCallback(
    (next: string) => navigate(`q=${encodeURIComponent(next)}`),
    [navigate],
  );
  const browseCategory = useCallback(
    (next: string) => navigate(`category=${encodeURIComponent(next)}`),
    [navigate],
  );

  return (
    <>
      <BrowseHeroBand>
        <SearchAutocomplete
          variant="hero"
          onSearch={runSearch}
          onSelectCategory={browseCategory}
          defaultValue={q}
        />
      </BrowseHeroBand>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
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
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={SearchX}
              title="Something went wrong"
              description="We couldn't load recommendations just now."
              action={
                <Button variant="outline" className="rounded-full" onClick={retry}>
                  Try again
                </Button>
              }
            />
          ) : results.length > 0 ? (
            <div className="flex flex-col gap-3">
              {results.map((r) => (
                <RecommendationCard key={r.id} rec={r} signedIn={signedIn} />
              ))}
              <RecommendMoreCta category={mode === 'browse' ? category : ''} />
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
    </>
  );
}

export default function BrowsePage() {
  // Gate BrowseInner behind a client mount: it reads window.location in its
  // initial state, so rendering it during the static build (or the first
  // hydration pass) would mismatch. The fallback matches the static HTML exactly.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <BrowseFallback />;

  return <BrowseInner />;
}

function BrowseFallback() {
  return (
    <>
      <BrowseHeroBand>
        <Skeleton className="h-[52px] w-full max-w-[540px] rounded-full bg-white/20" />
      </BrowseHeroBand>
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </main>
    </>
  );
}
