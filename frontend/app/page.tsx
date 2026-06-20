'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getSupabase } from '@/lib/supabase';
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

export default function Home() {
  // auth
  const [email, setEmail] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [signInEmail, setSignInEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [sending, setSending] = useState(false);

  // discovery (search + browse share one results list)
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>(null);

  const refreshCategories = useCallback(() => {
    getCategoryCounts().then(setCategories).catch(() => {});
  }, []);

  const loadCategory = useCallback((category: string) => {
    setMode('browse');
    setSelected(category);
    setQuery('');
    setLoading(true);
    getRecommendations(category)
      .then(setResults)
      .catch(() => toast.error("Couldn't load recommendations"))
      .finally(() => setLoading(false));
  }, []);

  const runSearch = useCallback((q: string) => {
    setMode('search');
    setQuery(q);
    setSelected(null);
    setLoading(true);
    searchRecommendations(q)
      .then(setResults)
      .catch(() => toast.error('Search failed'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refreshCategories();
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
      setLoadingSession(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, [refreshCategories]);

  function onAdded() {
    refreshCategories();
    if (mode === 'search' && query) runSearch(query);
    else if (mode === 'browse' && selected) loadCategory(selected);
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
        {categories.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
        ) : (
          <CategoryChips items={categories} selected={selected} onSelect={loadCategory} />
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
