'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CATEGORIES } from '@/lib/categories';
import { addRecommendation, endorse, type Recommendation } from '@/lib/api';
import { capture } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AddRecommendationForm({
  onAdded,
}: {
  // Receives the new record on a fresh add; called with no argument when the
  // dedupe "+1 it instead" path runs (nothing new was created).
  onAdded?: (rec?: Recommendation) => void;
}) {
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const name = businessName.trim();

    const result = await addRecommendation({
      business_name: name,
      category,
      note: note.trim() || undefined,
    });
    setSubmitting(false);

    if (result.ok) {
      capture('recommendation_added', { category: result.recommendation.category });
      toast.success('Recommendation added', {
        description: `${result.recommendation.business_name} · ${result.recommendation.category}`,
      });
      setBusinessName('');
      setCategory('');
      setNote('');
      onAdded?.(result.recommendation);
    } else if (result.kind === 'duplicate') {
      const existingId = result.existingId;
      toast.info('Already recommended', {
        description: `${name} is already listed under ${category}.`,
        action: existingId
          ? {
              label: '+1 it instead',
              onClick: async () => {
                const r = await endorse(existingId);
                if (r.ok) {
                  capture('endorsement_added', { recommendation_id: existingId });
                  toast.success('Thanks for the +1');
                  onAdded?.();
                } else if (r.kind === 'already') {
                  toast.success("You already +1'd this");
                  onAdded?.();
                } else {
                  toast.error("Couldn't +1");
                }
              },
            }
          : undefined,
      });
    } else if (result.kind === 'unauthenticated') {
      toast.error('Please sign in again', { description: 'Your session expired.' });
    } else {
      toast.error("Couldn't add recommendation", { description: result.message });
    }
  }

  const canSubmit = businessName.trim().length > 0 && category.length > 0 && !submitting;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Add a recommendation</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="business">Business name</Label>
            <Input
              id="business"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              maxLength={200}
              placeholder="e.g. Joe's Plumbing"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category" className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              placeholder="Why do you recommend them?"
              className="min-h-20"
            />
          </div>

          <Button type="submit" disabled={!canSubmit} className="w-full rounded-full">
            {submitting ? 'Adding…' : 'Add recommendation'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
