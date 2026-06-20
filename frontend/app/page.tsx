'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getSupabase } from '@/lib/supabase';
import {
  getCategoryCounts,
  getRecommendations,
  type CategoryCount,
  type Recommendation,
} from '@/lib/api';
import AddRecommendationForm from '@/components/AddRecommendationForm';
import { CategoryChips } from '@/components/CategoryChips';
import { RecommendationCard } from '@/components/RecommendationCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function Home() {
  // auth
  const [email, setEmail] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [signInEmail, setSignInEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [sending, setSending] = useState(false);

  // browse
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const refreshCategories = useCallback(() => {
    getCategoryCounts().then(setCategories).catch(() => {});
  }, []);

  const loadCategory = useCallback((category: string) => {
    setSelected(category);
    setLoadingRecs(true);
    getRecommendations(category)
      .then(setRecs)
      .catch(() => toast.error("Couldn't load recommendations"))
      .finally(() => setLoadingRecs(false));
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
    if (selected) loadCategory(selected);
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
    <main className="mx-auto flex w-full max-w-[680px] flex-col gap-10 px-4 py-8 sm:py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WhoDoYaUse</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Trusted local pros, recommended by your neighbors.
          </p>
        </div>
        {email && (
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign out
          </Button>
        )}
      </header>

      {/* Browse — public */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Browse by category</h2>

        {categories.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
        ) : (
          <CategoryChips items={categories} selected={selected} onSelect={loadCategory} />
        )}

        {selected ? (
          <div className="flex flex-col gap-3">
            {loadingRecs ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-2xl" />
              ))
            ) : recs.length > 0 ? (
              recs.map((r) => <RecommendationCard key={r.id} rec={r} />)
            ) : (
              <p className="text-sm text-muted-foreground">
                No recommendations for {selected} yet — be the first to add one.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pick a category to see what your neighbors recommend.
          </p>
        )}
      </section>

      {/* Add — requires sign-in */}
      <section className="flex flex-col gap-4">
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
