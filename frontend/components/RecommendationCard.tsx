'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ThumbsUp, Phone, Mail, Globe, ExternalLink, User, MessageSquarePlus, PencilLine } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SuggestEditDialog } from '@/components/SuggestEditDialog';
import { cn } from '@/lib/utils';
import {
  deleteNote,
  endorse,
  unendorse,
  updateRecommendationNote,
  type EndorsementNote,
  type Recommendation,
} from '@/lib/api';
import { capture } from '@/lib/analytics';

const ENDORSEMENT_NOTE_MAX = 1000;
// How many neighbor notes to show before collapsing the rest behind a toggle,
// so a popular pro's card stays scannable instead of a wall of quotes.
const NOTE_PREVIEW_COUNT = 2;

// Which note the shared editor / confirm dialog is acting on.
type NoteTarget = 'take' | 'initial';

// Small inline text-button style shared by the Edit / Delete controls.
const linkBtn =
  'cursor-pointer rounded-full underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc23d] focus-visible:ring-offset-2';

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
  const [initialNote, setInitialNote] = useState(rec.note);
  const [editing, setEditing] = useState<NoteTarget | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [confirming, setConfirming] = useState<NoteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  // The viewer's own +1 note, if any — gets edit/delete controls, and its
  // presence turns "Add your take" into an edit affordance instead.
  const myNote = notes.find((n) => n.is_mine);
  // Show the viewer's own note first so its controls are always in the preview.
  const orderedNotes = myNote ? [myNote, ...notes.filter((n) => !n.is_mine)] : notes;

  // Resync to server truth when the list is refetched (the card instance is
  // reused across refetches via a stable key, so useState's initial value is
  // not re-read on its own).
  useEffect(() => {
    setCount(rec.endorsement_count);
    setEndorsed(rec.endorsed_by_me);
    setNotes(rec.endorsement_notes);
    setInitialNote(rec.note);
  }, [rec.endorsement_count, rec.endorsed_by_me, rec.endorsement_notes, rec.note]);

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
          // Removing the +1 deletes the endorsement server-side, and the note
          // rode on it — drop it locally too so the card stays truthful.
          setNotes((prev) => prev.filter((n) => !n.is_mine));
        } else {
          toast.error("Couldn't undo your +1");
        }
      }
    } finally {
      setPending(false);
    }
  }

  // Open the shared editor for a given note, seeded with its current text.
  function openEditor(target: NoteTarget, seed = '') {
    if (!signedIn) {
      promptSignIn(target === 'initial' ? 'Sign in to edit your note' : 'Sign in to add your take');
      return;
    }
    setEditing(target);
    setNoteText(seed);
  }

  function cancelEdit() {
    setEditing(null);
    setNoteText('');
  }

  async function saveNote() {
    const text = noteText.trim();
    if (!text) return;
    setSavingNote(true);
    try {
      if (editing === 'initial') {
        const r = await updateRecommendationNote(rec.id, text);
        if (r.ok) {
          setInitialNote(r.note ?? text);
          cancelEdit();
          toast.success('Your note was updated');
        } else if (r.kind === 'unauthenticated') {
          toast.error('Please sign in again');
        } else if (r.kind === 'notfound') {
          toast.error("Couldn't find this recommendation");
        } else {
          toast.error("Couldn't save your note");
        }
      } else {
        const editingTake = !!myNote;
        // A note implicitly +1s (the backend upserts the endorsement), so reflect
        // both the count and the quote locally without waiting for a refetch.
        const r = await endorse(rec.id, text);
        if (r.ok) {
          capture('endorsement_added', { recommendation_id: rec.id, has_note: true });
          // One note per user: replace mine if it exists, else add it — mine first
          // so it's always visible with its controls (not hidden past the preview).
          setNotes((prev) => [
            { name: 'You', note: text, is_mine: true },
            ...prev.filter((n) => !n.is_mine),
          ]);
          setCount(r.count);
          setEndorsed(true);
          cancelEdit();
          toast.success(editingTake ? 'Your note was updated' : 'Thanks for your take');
        } else if (r.kind === 'unauthenticated') {
          toast.error('Please sign in again');
        } else {
          toast.error("Couldn't save your note");
        }
      }
    } finally {
      setSavingNote(false);
    }
  }

  async function confirmDelete() {
    const target = confirming;
    if (!target) return;
    setDeleting(true);
    try {
      if (target === 'take') {
        const r = await deleteNote(rec.id);
        if (r.ok) {
          setNotes((prev) => prev.filter((n) => !n.is_mine));
          toast.success('Your note was removed');
        } else {
          toast.error("Couldn't remove your note");
        }
      } else {
        const r = await updateRecommendationNote(rec.id, '');
        if (r.ok) {
          setInitialNote(null);
          toast.success('Your note was removed');
        } else {
          toast.error("Couldn't remove your note");
        }
      }
    } finally {
      setDeleting(false);
      setConfirming(null);
    }
  }

  function openSuggest() {
    if (!signedIn) {
      promptSignIn('Sign in to suggest an edit');
      return;
    }
    setSuggestOpen(true);
  }

  const contactLinks = [
    rec.phone && { icon: Phone, label: rec.phone, href: `tel:${rec.phone}` },
    rec.email && { icon: Mail, label: rec.email, href: `mailto:${rec.email}` },
    rec.website && { icon: Globe, label: 'Website', href: rec.website },
    rec.social_link && { icon: ExternalLink, label: 'Social', href: rec.social_link },
  ].filter(Boolean) as { icon: typeof Phone; label: string; href: string }[];

  const chipClass =
    'inline-flex items-center gap-1.5 rounded-full bg-[#eaf3ee] px-3 py-1 text-[13px] font-semibold text-[#15493f] transition-colors hover:bg-[#dcebe1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc23d] focus-visible:ring-offset-1';

  // The shared note editor, placed inline wherever an edit is in progress.
  function noteEditor(placeholder: string, saveLabel: string) {
    return (
      <div className="flex flex-col gap-2">
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          maxLength={ENDORSEMENT_NOTE_MAX}
          placeholder={placeholder}
          className="min-h-16"
          aria-label="Note editor"
          autoFocus
        />
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full"
            onClick={cancelEdit}
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
            {savingNote ? 'Saving…' : saveLabel}
          </Button>
        </div>
      </div>
    );
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

        {/* The recommendation's own note (written by its creator). Editable and
            deletable only by the creator (created_by_me). */}
        {editing === 'initial' ? (
          noteEditor('Your note about this pro', 'Save note')
        ) : initialNote ? (
          <figure className="rounded-xl bg-[#f1f6f1] px-3.5 py-3 text-sm leading-[1.5] text-[#33433b]">
            <blockquote>&ldquo;{initialNote}&rdquo;</blockquote>
            {rec.created_by_me && (
              <figcaption className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#7a887f]">
                <button
                  type="button"
                  onClick={() => openEditor('initial', initialNote)}
                  className={cn(linkBtn, 'text-[#15493f]')}
                >
                  Edit
                </button>
                <span aria-hidden>·</span>
                <button
                  type="button"
                  onClick={() => setConfirming('initial')}
                  className={cn(linkBtn, 'text-[#b00020]')}
                >
                  Delete
                </button>
              </figcaption>
            )}
          </figure>
        ) : rec.created_by_me ? (
          <button
            type="button"
            onClick={() => openEditor('initial')}
            className="-ml-2.5 inline-flex cursor-pointer items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[13px] font-semibold text-[#15493f] transition-colors hover:bg-[#eaf3ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc23d] focus-visible:ring-offset-2"
          >
            <MessageSquarePlus className="size-4" aria-hidden />
            Add a note
          </button>
        ) : null}

        {/* Neighbor +1 notes — the trust workhorse: stacked, attributed quotes.
            Collapsed to a preview so a popular pro's card stays scannable. */}
        {(notesExpanded ? orderedNotes : orderedNotes.slice(0, NOTE_PREVIEW_COUNT)).map((n, i) => (
          <figure
            key={n.is_mine ? 'mine' : `${n.name}-${i}`}
            className={cn(
              'rounded-xl bg-[#f1f6f1] px-3.5 py-3 text-sm leading-[1.5] text-[#33433b]',
              n.is_mine && 'ring-1 ring-[#c7dccf]',
            )}
          >
            <blockquote>&ldquo;{n.note}&rdquo;</blockquote>
            <figcaption className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-[#7a887f]">
              <span>— {n.is_mine ? 'You' : n.name}</span>
              {n.is_mine && editing === null && (
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditor('take', n.note)}
                    className={cn(linkBtn, 'text-[#15493f]')}
                  >
                    Edit
                  </button>
                  <span aria-hidden>·</span>
                  <button
                    type="button"
                    onClick={() => setConfirming('take')}
                    className={cn(linkBtn, 'text-[#b00020]')}
                  >
                    Delete
                  </button>
                </span>
              )}
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

        {editing === 'take' ? (
          noteEditor('Why do you use them too?', myNote ? 'Save note' : 'Post take')
        ) : (
          <div className="flex items-center justify-between gap-3">
            {myNote ? (
              <span />
            ) : (
              <button
                type="button"
                onClick={() => openEditor('take')}
                className="-ml-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold text-[#15493f] transition-colors hover:bg-[#eaf3ee] hover:text-[#0e2a20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc23d] focus-visible:ring-offset-2"
              >
                <MessageSquarePlus className="size-4" aria-hidden />
                Add your take
              </button>
            )}
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

        {/* Quiet correction path — users propose fixes, they don't self-edit. */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openSuggest}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full px-1.5 py-0.5 text-[12.5px] font-medium text-[#7a887f] transition-colors hover:text-[#15493f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc23d] focus-visible:ring-offset-2"
          >
            <PencilLine className="size-3.5" aria-hidden />
            Suggest an edit
          </button>
        </div>
      </CardContent>

      <SuggestEditDialog rec={rec} open={suggestOpen} onOpenChange={setSuggestOpen} />

      <Dialog open={confirming !== null} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Delete this note?</DialogTitle>
            <DialogDescription>
              This can&apos;t be undone.{' '}
              {confirming === 'initial'
                ? 'Your recommendation stays — only the note is removed.'
                : 'Your +1 stays — only your note is removed.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => setConfirming(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-full"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
