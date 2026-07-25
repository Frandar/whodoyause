'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { CATEGORIES } from '@/lib/categories';
import { addRecommendation, endorse, type Recommendation } from '@/lib/api';
import { capture } from '@/lib/analytics';
import { cn } from '@/lib/utils';
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

// Optional contact fields, rendered behind the "Add contact details" disclosure.
// Kept flat and data-driven so the markup stays short and the fields stay easy.
type ContactKey = 'phone' | 'email' | 'website' | 'contact_name' | 'social_link';

// Live US-style phone mask: format digits as the user types so the expected
// shape is obvious. Kept dependency-free and lenient — we strip to digits, drop
// a leading US country code, and cap at 10 digits. (Numbers outside this shape
// are rare for a neighborhood tool; the backend still stores whatever we send.)
function formatUsPhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const CONTACT_FIELDS: {
  key: ContactKey;
  label: string;
  placeholder: string;
  type?: string;
  inputMode?: 'tel' | 'email' | 'url';
  maxLength: number;
  // Optional live formatter applied on each keystroke (e.g. the phone mask).
  format?: (value: string) => string;
}[] = [
  { key: 'phone', label: 'Phone', placeholder: '(555) 123-4567', type: 'tel', inputMode: 'tel', maxLength: 40, format: formatUsPhone },
  { key: 'email', label: 'Email', placeholder: 'name@example.com', type: 'email', inputMode: 'email', maxLength: 200 },
  // No type="url" on the link fields: native URL validation rejects bare domains
  // like "joesplumbing.com", but the backend prepends https:// for us. inputMode
  // still gives mobile users the URL keyboard.
  { key: 'website', label: 'Website', placeholder: 'joesplumbing.com', inputMode: 'url', maxLength: 300 },
  { key: 'contact_name', label: 'Who to ask for', placeholder: 'e.g. Joe', maxLength: 120 },
  { key: 'social_link', label: 'Social link', placeholder: 'facebook.com/…', inputMode: 'url', maxLength: 300 },
];

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
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold">Add a recommendation</CardTitle>
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

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setShowContact((v) => !v)}
              aria-expanded={showContact}
              aria-controls="contact-details"
              className="-ml-2.5 flex cursor-pointer items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-sm font-semibold text-[#15493f] transition-colors hover:bg-[#eaf3ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc23d] focus-visible:ring-offset-2"
            >
              <ChevronDown
                className={cn('size-4 transition-transform', showContact && 'rotate-180')}
                aria-hidden
              />
              Add contact details{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </button>

            {showContact && (
              <div id="contact-details" className="flex flex-col gap-4">
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
            )}
          </div>

          <Button type="submit" disabled={!canSubmit} className="w-full rounded-full">
            {submitting ? 'Adding…' : 'Add recommendation'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
