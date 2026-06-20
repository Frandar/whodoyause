import { ThumbsUp, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Recommendation } from '@/lib/api';

export function RecommendationCard({ rec }: { rec: Recommendation }) {
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

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <User className="size-3.5" aria-hidden />
            {rec.created_by_name}
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <ThumbsUp className="size-3.5" aria-hidden />
            {rec.endorsement_count}
            <span className="sr-only"> endorsements</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
