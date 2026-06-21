'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getSupabase } from '@/lib/supabase';
import { capture, identify, resetIdentity } from '@/lib/analytics';
import {
  getCategoryCounts,
  getRecommendations,
  searchRecommendations,
  type CategoryCount,
  type Recommendation,
} from '@/lib/api';
import AddRecommendationForm from '@/components/AddRecommendationForm';
import { SearchHero } from '@/components/SearchHero';
import { CategoryChips } from '@/components/CategoryChips';
import { RecommendationCard } from '@/components/RecommendationCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Mode = 'search' | 'browse' | null;

// First-time-signup detection. Magic-link auth creates the user row when the
// link is *requested* but only fires SIGNED_IN when it's *clicked* (often
// minutes later), so a tight "created moments ago" window misses real signups.
// Instead we record which user ids this device has already counted and fire
// once per genuinely new account (created within the link's lifetime — a
// generous 24h guards against clock skew while still excluding existing users
// signing in on a fresh device).
const SEEN_USERS_KEY = 'wdyu_seen_users';
const SIGNUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function isNewSignup(userId: string, createdAt: string | undefined): boolean {
  try {
    const seen: string[] = JSON.parse(localStorage.getItem(SEEN_USERS_KEY) || '[]');
    if (seen.includes(userId)) return false;
    localStorage.setItem(SEEN_USERS_KEY, JSON.stringify([...seen, userId]));
    if (!createdAt) return false;
    return Date.now() - new Date(createdAt).getTime() < SIGNUP_MAX_AGE_MS;
  } catch {
    // localStorage unavailable (private mode) — can't dedupe, so skip rather
    // than risk counting a signup on every sign-in.
    return false;
  }
}

export default function Home() {
  // auth
  const [email, setEmail] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [signInEmail, setSignInEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [sending, setSending] = useState(false);

  // discovery (search + browse share one results list)
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [categoriesError, setCategoriesError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>(null);

  // Monotonic id so an earlier (slower) fetch can't overwrite a later one's
  // results. Each fetch claims an id; only the latest may touch shared state.
  const reqId = useRef(0);

  const refreshCategories = useCallback(() => {
    getCategoryCounts()
      .then((data) => {
        setCategories(data);
        setCategoriesError(false);
      })
      .catch(() => setCategoriesError(true));
  }, []);

  // Pure fetch (no analytics) — also used to silently refresh after an add.
  const fetchCategory = useCallback((category: string): Promise<Recommendation[] | null> => {
    const id = ++reqId.current;
    setMode('browse');
    setSelected(category);
    setQuery('');
    setLoading(true);
    return getRecommendations(category)
      .then((data) => {
        if (id !== reqId.current) return null; // superseded
        setResults(data);
        return data;
      })
      .catch(() => {
        if (id !== reqId.current) return null;
        setResults([]);
        toast.error("Couldn't load recommendations");
        return null;
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
  }, []);

  const fetchSearch = useCallback((q: string): Promise<Recommendation[] | null> => {
    const id = ++reqId.current;
    setMode('search');
    setQuery(q);
    setSelected(null);
    setLoading(true);
    return searchRecommendations(q)
      .then((data) => {
        if (id !== reqId.current) return null; // superseded
        setResults(data);
        return data;
      })
      .catch(() => {
        if (id !== reqId.current) return null;
        setResults([]);
        toast.error('Search failed');
        return null;
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
  }, []);

  // User-initiated entry points fire analytics; the fetch helpers above do not,
  // so silently refreshing after an add never double-counts funnel events.
  const browseCategory = useCallback(
    (category: string) => {
      capture('category_browsed', { category });
      fetchCategory(category);
    },
    [fetchCategory],
  );

  const runSearch = useCallback(
    (q: string) => {
      fetchSearch(q).then((data) => {
        if (!data) return; // error or superseded — don't log a phantom search
        capture('search', { query: q, category: null, results_count: data.length });
        if (data.length === 0) capture('search_zero_results', { query: q, category: null });
      });
    },
    [fetchSearch],
  );

  useEffect(() => {
    refreshCategories();
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      setEmail(user?.email ?? null);
      if (user) identify(user.id, { email: user.email });
      setLoadingSession(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      setEmail(user?.email ?? null);
      if (user) {
        identify(user.id, { email: user.email });
        if (event === 'SIGNED_IN' && isNewSignup(user.id, user.created_at)) {
          capture('signup');
        }
      } else if (event === 'SIGNED_OUT') {
        resetIdentity();
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [refreshCategories]);

  function onAdded() {
    refreshCategories();
    // Refresh the current view WITHOUT re-firing search/browse analytics.
    if (mode === 'search' && query) fetchSearch(query);
    else if (mode === 'browse' && selected) fetchCategory(selected);
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const { error } = await getSupabase().auth.signInWithOtp({ email: signInEmail });
    setSending(false);
    if (error) {
      if (error.message.toLowerCase().includes('rate limit')) {
        toast.error('Too many sign-in emails', {
          description: 'Wait a minute and try again, or use the link already sent.',
        });
      } else {
        toast.error("Couldn't send the link", { description: error.message });
      }
    } else {
      setMagicLinkSent(true);
    }
  }

  async function signOut() {
    await getSupabase().auth.signOut();
    setMagicLinkSent(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-[680px] flex-col gap-8 px-4 py-6 sm:py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight">WhoDoYaUse</h1>
        {email && (
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign out
          </Button>
        )}
      </header>

      <SearchHero onSearch={runSearch} />

      {/* Discovery — public */}
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
          <CategoryChips items={categories} selected={selected} onSelect={browseCategory} />
        )}

        {mode === 'search' && !loading && (
          <p className="text-sm text-muted-foreground">
            {results.length > 0
              ? `Results for “${query}”`
              : `No matches for “${query}”`}
          </p>
        )}

        {mode ? (
          <div className="flex flex-col gap-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-2xl" />
              ))
            ) : results.length > 0 ? (
              results.map((r) => <RecommendationCard key={r.id} rec={r} signedIn={!!email} />)
            ) : mode === 'search' ? (
              <p className="text-sm text-muted-foreground">
                Try a category above, or sign in to add the first recommendation for “{query}”.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No recommendations for {selected} yet — be the first to add one.
              </p>
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Search above or pick a category to see what your neighbors recommend.
          </p>
        )}
      </section>

      {/* Add — requires sign-in */}
      <section className="flex flex-col gap-4 border-t pt-8">
        {loadingSession ? (
          <Skeleton className="h-56 w-full rounded-2xl" />
        ) : email ? (
          <>
            <p className="text-sm text-muted-foreground">Signed in as {email}</p>
            <AddRecommendationForm onAdded={onAdded} />
          </>
        ) : magicLinkSent ? (
          <Card className="rounded-2xl">
            <CardContent className="p-6 text-center">
              <p className="font-medium">Check your email</p>
              <p className="mt-1 text-sm text-muted-foreground">
                We sent a sign-in link to {signInEmail}.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Add a recommendation</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={signIn} className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">Sign in to add a recommendation.</p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder="you@email.com"
                  />
                </div>
                <Button type="submit" disabled={sending || !signInEmail} className="rounded-full">
                  {sending ? 'Sending…' : 'Send magic link'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
