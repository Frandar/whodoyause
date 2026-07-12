'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { endorse, unendorse, type Recommendation } from '@/lib/api';
import { capture } from '@/lib/analytics';

// Neighbor-first layout (design reference card): the neighbor's name leads,
// "recommends" bridges, the business is the Bricolage payoff, and the note
// reads as a quote. Trust framing IS the product — don't invert this.
export function RecommendationCard({
  rec,
  signedIn,
}: {
  rec: Recommendation;
  signedIn: boolean;
}) {
  const router = useRouter();
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
      toast.info('Sign in to +1 a recommendation', {
        action: {
          label: 'Sign in',
          onClick: () =>
            router.push(
              `/signin?next=${encodeURIComponent(
                window.location.pathname + window.location.search,
              )}`,
            ),
        },
      });
      return;
    }
    setPending(true);
    try {
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
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="gap-0 py-5">
      <CardContent className="flex flex-col gap-3 px-5">
        <div className="flex items-start justify-between gap-3">
          <span className="flex items-center gap-2.5">
            <Avatar name={rec.created_by_name} />
            <span className="flex flex-col">
              <span className="text-[15px] font-bold leading-tight">
                {rec.created_by_name}
              </span>
              <span className="text-[13px] text-[#7a887f]">recommends</span>
            </span>
          </span>
          <Badge variant="secondary" className="shrink-0">
            {rec.category}
          </Badge>
        </div>

        <h3 className="font-display text-xl font-extrabold leading-tight tracking-[-0.01em]">
          {rec.business_name}
        </h3>

        {rec.note && (
          <p className="rounded-xl bg-[#f1f6f1] px-3.5 py-3 text-sm leading-[1.5] text-[#33433b]">
            &ldquo;{rec.note}&rdquo;
          </p>
        )}

        <div className="flex justify-end">
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
