'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CONTACT_FIELDS, type ContactKey } from '@/lib/contact';
import { suggestEdit, type Recommendation } from '@/lib/api';
import { capture } from '@/lib/analytics';

const MESSAGE_MAX = 1000;

// Lets a neighbor propose corrections (wrong phone/email/etc.) without editing
// the live record — the submission is queued for the founders to review.
export function SuggestEditDialog({
  rec,
  open,
  onOpenChange,
}: {
  rec: Recommendation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const seed = () =>
    Object.fromEntries(
      CONTACT_FIELDS.map((f) => [f.key, rec[f.key] ?? '']),
    ) as Record<ContactKey, string>;

  const [fields, setFields] = useState<Record<ContactKey, string>>(seed);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Re-seed from the current record each time the dialog opens.
  useEffect(() => {
    if (open) {
      setFields(seed());
      setMessage('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rec.id]);

  async function submit() {
    // Send only the fields the neighbor actually changed, plus the message —
    // that's exactly what the founders need to see.
    const changed: Record<string, string> = {};
    for (const f of CONTACT_FIELDS) {
      const value = fields[f.key].trim();
      if (value && value !== (rec[f.key] ?? '')) changed[f.key] = value;
    }
    const msg = message.trim();
    if (Object.keys(changed).length === 0 && !msg) {
      toast.info('Add a correction or a short note first');
      return;
    }

    setSubmitting(true);
    const r = await suggestEdit(rec.id, { ...changed, message: msg || undefined });
    setSubmitting(false);

    if (r.ok) {
      capture('edit_suggested', { recommendation_id: rec.id });
      toast.success('Thanks — a neighbor will review it', {
        description: 'Suggestions are checked before anything changes.',
      });
      onOpenChange(false);
    } else if (r.kind === 'unauthenticated') {
      toast.error('Please sign in again', { description: 'Your session expired.' });
    } else {
      toast.error("Couldn't send your suggestion", { description: r.message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Suggest an edit</DialogTitle>
          <DialogDescription>
            Spotted something wrong for {rec.business_name}? Send the correct details and a
            neighbor will review it — nothing changes automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {CONTACT_FIELDS.map((field) => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <Label htmlFor={`edit-${field.key}`}>{field.label}</Label>
              <Input
                id={`edit-${field.key}`}
                type={field.type ?? 'text'}
                inputMode={field.inputMode}
                value={fields[field.key]}
                maxLength={field.maxLength}
                placeholder={field.placeholder}
                onChange={(e) =>
                  setFields((prev) => ({
                    ...prev,
                    [field.key]: field.format ? field.format(e.target.value) : e.target.value,
                  }))
                }
              />
            </div>
          ))}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-message">
              What&apos;s off?{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="edit-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MESSAGE_MAX}
              placeholder="e.g. This number is disconnected — the new one is above."
              className="min-h-16"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" className="rounded-full" onClick={submit} disabled={submitting}>
            {submitting ? 'Sending…' : 'Send suggestion'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
