'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ThumbsUp, Phone, Mail, Globe, ExternalLink, User, MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { endorse, unendorse, type EndorsementNote, type Recommendation } from '@/lib/api';
import { capture } from '@/lib/analytics';

const ENDORSEMENT_NOTE_MAX = 1000;
// How many neighbor notes to show before collapsing the rest behind a toggle,
// so a popular pro's card stays scannable instead of a wall of quotes.
const NOTE_PREVIEW_COUNT = 2;

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
  const [notes, setNotes] = useState<EndorsementNote[]>(rec.endorsement_notes);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Resync to server truth when the list is refetched (the card instance is
  // reused across refetches via a stable key, so useState's initial value is
  // not re-read on its own).
  useEffect(() => {
    setCount(rec.endorsement_count);
    setEndorsed(rec.endorsed_by_me);
    setNotes(rec.endorsement_notes);
  }, [rec.endorsement_count, rec.endorsed_by_me, rec.endorsement_notes]);

  function promptSignIn(message: string) {
    toast.info(message, {
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
  }

  async function toggle() {
    if (!signedIn) {
      promptSignIn('Sign in to +1 a recommendation');
      return;
    }
    setPending(true);
    try {
      if (!endorsed) {
        const r = await endorse(rec.id);
        if (r.ok) {
          capture('endorsement_added', { recommendation_id: rec.id, has_note: false });
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

  function openNoteBox() {
    if (!signedIn) {
      promptSignIn('Sign in to add your take');
      return;
    }
    setAddingNote(true);
  }

  async function saveNote() {
    const text = noteText.trim();
    if (!text) return;
    setSavingNote(true);
    try {
      // A note implicitly +1s (the backend upserts the endorsement), so reflect
      // both the count and the quote locally without waiting for a refetch.
      const r = await endorse(rec.id, text);
      if (r.ok) {
        capture('endorsement_added', { recommendation_id: rec.id, has_note: true });
        setNotes((prev) => [...prev, { name: 'You', note: text }]);
        setNotesExpanded(true); // so their just-added take is visible past the preview
        setCount(r.count);
        setEndorsed(true);
        setNoteText('');
        setAddingNote(false);
        toast.success('Thanks for your take');
      } else if (r.kind === 'unauthenticated') {
        toast.error('Please sign in again');
      } else {
        toast.error("Couldn't save your note");
      }
    } finally {
      setSavingNote(false);
    }
  }

  const contactLinks = [
    rec.phone && { icon: Phone, label: rec.phone, href: `tel:${rec.phone}` },
    rec.email && { icon: Mail, label: rec.email, href: `mailto:${rec.email}` },
    rec.website && { icon: Globe, label: 'Website', href: rec.website },
    rec.social_link && { icon: ExternalLink, label: 'Social', href: rec.social_link },
  ].filter(Boolean) as { icon: typeof Phone; label: string; href: string }[];

  const chipClass =
    'inline-flex items-center gap-1.5 rounded-full bg-[#eaf3ee] px-3 py-1 text-[13px] font-semibold text-[#15493f] transition-colors hover:bg-[#dcebe1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc23d] focus-visible:ring-offset-1';

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

        {/* Neighbor +1 notes — the trust workhorse: stacked, attributed quotes.
            Collapsed to a preview so a popular pro's card stays scannable. */}
        {(notesExpanded ? notes : notes.slice(0, NOTE_PREVIEW_COUNT)).map((n, i) => (
          <figure
            key={`${n.name}-${i}`}
            className="rounded-xl bg-[#f1f6f1] px-3.5 py-3 text-sm leading-[1.5] text-[#33433b]"
          >
            <blockquote>&ldquo;{n.note}&rdquo;</blockquote>
            <figcaption className="mt-1 text-[12.5px] font-semibold text-[#7a887f]">
              — {n.name}
            </figcaption>
          </figure>
        ))}

        {notes.length > NOTE_PREVIEW_COUNT && (
          <button
            type="button"
            onClick={() => setNotesExpanded((v) => !v)}
            aria-expanded={notesExpanded}
            className="-mt-0.5 cursor-pointer self-start text-[13px] font-semibold text-[#15493f] underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc23d] focus-visible:ring-offset-2 rounded-full"
          >
            {notesExpanded
              ? 'Show fewer notes'
              : `Show ${notes.length - NOTE_PREVIEW_COUNT} more ${
                  notes.length - NOTE_PREVIEW_COUNT === 1 ? 'note' : 'notes'
                }`}
          </button>
        )}

        {(rec.contact_name || contactLinks.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {rec.contact_name && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf3ee] px-3 py-1 text-[13px] font-semibold text-[#15493f]">
                <User className="size-3.5" aria-hidden />
                Ask for {rec.contact_name}
              </span>
            )}
            {contactLinks.map(({ icon: Icon, label, href }) => {
              const external = href.startsWith('http');
              return (
                <a
                  key={href}
                  href={href}
                  className={chipClass}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {label}
                </a>
              );
            })}
          </div>
        )}

        {addingNote ? (
          <div className="flex flex-col gap-2">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              maxLength={ENDORSEMENT_NOTE_MAX}
              placeholder="Why do you use them too?"
              className="min-h-16"
              aria-label="Your take on this recommendation"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-full"
                onClick={() => {
                  setAddingNote(false);
                  setNoteText('');
                }}
                disabled={savingNote}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-full"
                onClick={saveNote}
                disabled={savingNote || noteText.trim().length === 0}
              >
                {savingNote ? 'Saving…' : 'Post take'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={openNoteBox}
              className="-ml-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold text-[#15493f] transition-colors hover:bg-[#eaf3ee] hover:text-[#0e2a20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc23d] focus-visible:ring-offset-2"
            >
              <MessageSquarePlus className="size-4" aria-hidden />
              Add your take
            </button>
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
        )}
      </CardContent>
    </Card>
  );
}
