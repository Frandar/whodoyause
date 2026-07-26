'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { CATEGORIES } from '@/lib/categories';
import { addRecommendation, endorse, type Recommendation } from '@/lib/api';
import { capture } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { CONTACT_FIELDS, type ContactKey } from '@/lib/contact';
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
  initialCategory,
}: {
  // Receives the new record on a fresh add; called with no argument when the
  // dedupe "+1 it instead" path runs (nothing new was created).
  onAdded?: (rec?: Recommendation) => void;
  // Prefills the category (e.g. arriving from a category browse page). Ignored
  // if it isn't a known seed category.
  initialCategory?: string;
}) {
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState(
    initialCategory && (CATEGORIES as readonly string[]).includes(initialCategory)
      ? initialCategory
      : '',
  );
  const [note, setNote] = useState('');
  const [contact, setContact] = useState<Record<ContactKey, string>>({
    phone: '',
    email: '',
    website: '',
    contact_name: '',
    social_link: '',
  });
  const [showContact, setShowContact] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // A dedupe hit (409). Persisted in state so the "+1 instead" recovery stays on
  // screen until the user acts on it — see the duplicate branch in onSubmit.
  const [duplicate, setDuplicate] = useState<
    { id: string | null; name: string; category: string } | null
  >(null);
  const [endorsing, setEndorsing] = useState(false);

  async function endorseExisting() {
    if (!duplicate?.id) return;
    setEndorsing(true);
    try {
      const r = await endorse(duplicate.id);
      if (r.ok) {
        capture('endorsement_added', { recommendation_id: duplicate.id, has_note: false });
        toast.success('Thanks for the +1');
        setDuplicate(null);
        onAdded?.();
      } else if (r.kind === 'already') {
        toast.success("You already +1'd this");
        setDuplicate(null);
        onAdded?.();
      } else if (r.kind === 'unauthenticated') {
        toast.error('Please sign in again', { description: 'Your session expired.' });
      } else {
        toast.error("Couldn't +1");
      }
    } finally {
      setEndorsing(false);
    }
  }

  const setContactField = (key: ContactKey, value: string) =>
    setContact((prev) => ({ ...prev, [key]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const name = businessName.trim();

    // Only send contact fields the recommender actually filled in.
    const contactPayload = Object.fromEntries(
      CONTACT_FIELDS.map(({ key }) => [key, contact[key].trim() || undefined]),
    );

    let result;
    try {
      result = await addRecommendation({
        business_name: name,
        category,
        note: note.trim() || undefined,
        ...contactPayload,
      });
    } finally {
      // Always re-enable the form — a thrown rejection must never strand it
      // on "Adding…" with the button disabled.
      setSubmitting(false);
    }

    if (result.ok) {
      const hasContact = CONTACT_FIELDS.some(({ key }) => contact[key].trim().length > 0);
      capture('recommendation_added', {
        category: result.recommendation.category,
        has_contact: hasContact,
      });
      toast.success('Recommendation added', {
        description: `${result.recommendation.business_name} · ${result.recommendation.category}`,
      });
      setBusinessName('');
      setCategory('');
      setNote('');
      setContact({ phone: '', email: '', website: '', contact_name: '', social_link: '' });
      setShowContact(false);
      onAdded?.(result.recommendation);
    } else if (result.kind === 'duplicate') {
      // Held in form state, NOT a toast. This is US2's dedupe recovery — the
      // most important branch of the add flow — and a Sonner toast auto-dismisses
      // after ~4s, so the "+1 instead" action disappeared on a timer that the
      // user cannot extend (WCAG 2.2.1). It now persists until they act on it.
      setDuplicate({ id: result.existingId, name, category });
    } else if (result.kind === 'unauthenticated') {
      toast.error('Please sign in again', { description: 'Your session expired.' });
    } else {
      toast.error("Couldn't add recommendation", { description: result.message });
    }
  }

  const canSubmit = businessName.trim().length > 0 && category.length > 0 && !submitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold">Add a recommendation</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {duplicate && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-[14px] border border-border-strong bg-surface-tint px-4 py-3.5"
            >
              <p className="text-[14.5px] font-semibold text-primary">
                {duplicate.name} is already recommended under {duplicate.category}.
              </p>
              <p className="text-sm text-ink-muted">
                Adding your +1 pushes it higher for your neighbors than a duplicate
                entry would.
              </p>
              <div className="flex flex-wrap gap-2">
                {duplicate.id && (
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full"
                    onClick={endorseExisting}
                    disabled={endorsing}
                  >
                    {endorsing ? 'Adding your +1…' : '+1 it instead'}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => setDuplicate(null)}
                  disabled={endorsing}
                >
                  Edit my entry
                </Button>
              </div>
            </div>
          )}

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

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setShowContact((v) => !v)}
              aria-expanded={showContact}
              aria-controls="contact-details"
              className="-ml-2.5 flex cursor-pointer items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-sm font-semibold text-primary transition-colors hover:bg-surface-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ChevronDown
                className={cn('size-4 transition-transform', showContact && 'rotate-180')}
                aria-hidden
              />
              Add contact details{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </button>

            {/* Always in the DOM (hidden when collapsed) so the toggle's
                aria-controls points at a real element rather than a dangling
                IDREF, and so assistive tech can resolve the relationship. */}
            <div
              id="contact-details"
              hidden={!showContact}
              className="flex flex-col gap-4"
            >
                {CONTACT_FIELDS.map((field) => (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <Label htmlFor={field.key}>{field.label}</Label>
                    <Input
                      id={field.key}
                      type={field.type ?? 'text'}
                      inputMode={field.inputMode}
                      value={contact[field.key]}
                      onChange={(e) =>
                        setContactField(
                          field.key,
                          field.format ? field.format(e.target.value) : e.target.value,
                        )
                      }
                      maxLength={field.maxLength}
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
            </div>
          </div>

          <Button type="submit" disabled={!canSubmit} className="w-full rounded-full">
            {submitting ? 'Adding…' : 'Add recommendation'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
