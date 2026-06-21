'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, LogIn } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import AddRecommendationForm from '@/components/AddRecommendationForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Recommendation } from '@/lib/api';

export default function RecommendPage() {
  const { signedIn, loading, email } = useAuth();
  const [added, setAdded] = useState<Recommendation | null>(null);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Recommend a pro</h1>
        <p className="text-sm text-muted-foreground">
          Help a neighbor out — add a local business you trust.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-72 w-full rounded-2xl" />
      ) : !signedIn ? (
        <Card className="rounded-2xl shadow-soft">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-primary">
              <LogIn className="size-5" aria-hidden />
            </span>
            <p className="font-semibold">Sign in to add a recommendation</p>
            <p className="text-sm text-muted-foreground">
              It only takes a magic link — no password.
            </p>
            <Button asChild className="mt-1 rounded-full">
              <Link href="/signin?next=/recommend">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      ) : added ? (
        <Card className="rounded-2xl shadow-soft">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-success">
              <CheckCircle2 className="size-5" aria-hidden />
            </span>
            <p className="font-semibold">Recommendation added</p>
            <p className="text-sm text-muted-foreground">
              {added.business_name} · {added.category}
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline" className="rounded-full">
                <Link href={`/browse?category=${encodeURIComponent(added.category)}`}>
                  View in {added.category}
                </Link>
              </Button>
              <Button className="rounded-full" onClick={() => setAdded(null)}>
                Add another
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {email && <p className="text-sm text-muted-foreground">Signed in as {email}</p>}
          <AddRecommendationForm onAdded={(rec) => rec && setAdded(rec)} />
        </>
      )}
    </main>
  );
}
