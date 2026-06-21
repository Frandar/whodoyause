'use client';

import { useEffect, useState } from 'react';
import { ThumbsUp, User } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { endorse, unendorse, type Recommendation } from '@/lib/api';
import { capture } from '@/lib/analytics';

export function RecommendationCard({
  rec,
  signedIn,
}: {
  rec: Recommendation;
  signedIn: boolean;
}) {
  const [count, setCount] = useState(rec.endorsement_count);
  const [endorsed, setEndorsed] = useState(rec.endorsed_by_me);
  const [pending, setPending] = useState(false);

  // Resync to server truth when the list is refetched (the card instance is
  // reused across refetches via a stable key, so useState's initial value is
  // not re-read on its own).
  useEffect(() => {
    setCount(rec.endorsement_count);
    setEndorsed(rec.endorsed_by_me);
  }, [rec.endorsement_count, rec.endorsed_by_me]);

  async function toggle() {
    if (!signedIn) {
      toast.info('Sign in to +1 a recommendation');
      return;
    }
    setPending(true);
    if (!endorsed) {
      const r = await endorse(rec.id);
      if (r.ok) {
        capture('endorsement_added', { recommendation_id: rec.id });
        setCount(r.count);
        setEndorsed(true);
      } else if (r.kind === 'already') {
        setCount(r.count);
        setEndorsed(true);
      } else if (r.kind === 'unauthenticated') {
        toast.error('Please sign in again');
      } else {
        toast.error("Couldn't +1");
      }
    } else {
      const r = await unendorse(rec.id);
      if (r.ok) {
        setCount(r.count);
        setEndorsed(false);
      } else {
        toast.error("Couldn't undo your +1");
      }
    }
    setPending(false);
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold leading-tight">{rec.business_name}</h3>
          <Badge variant="secondary" className="shrink-0">
            {rec.category}
          </Badge>
        </div>

        {rec.note && <p className="text-sm text-muted-foreground">{rec.note}</p>}

        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <User className="size-3.5" aria-hidden />
            {rec.created_by_name}
          </span>

          <Button
            type="button"
            variant={endorsed ? 'default' : 'outline'}
            size="sm"
            onClick={toggle}
            disabled={pending}
            aria-pressed={endorsed}
            aria-label={endorsed ? 'Remove your +1' : '+1 this recommendation'}
            className="h-8 rounded-full"
          >
            <ThumbsUp className={cn('size-3.5', endorsed && 'fill-current')} aria-hidden />
            {count}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
