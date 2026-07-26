'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Only allow same-origin relative paths as the post-sign-in destination.
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function SignInInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const { signedIn, loading, sendMagicLink } = useAuth();

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Already signed in → there's nothing to do here; go where they were headed.
  useEffect(() => {
    if (!loading && signedIn) router.replace(next);
  }, [loading, signedIn, next, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const result = await sendMagicLink(email, { firstName, lastName });
    setSending(false);
    if (result.ok) {
      setSent(true);
    } else if (result.rateLimited) {
      toast.error('Too many sign-in emails', {
        description: 'Wait a minute and try again, or use the link already sent.',
      });
    } else {
      toast.error("Couldn't send the link", { description: result.message });
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      {sent ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-primary">
              <MailCheck className="size-5" aria-hidden />
            </span>
            <p className="font-semibold">Check your email</p>
            <p className="text-sm text-muted-foreground">
              We sent a sign-in link to {email}. Open it on this device to finish signing in.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Sign in</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Sign in with a magic link to add recommendations and +1 your neighbors&apos;.
                New here? Your name is what neighbors see on your recommendations — we never
                show your email.
              </p>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="first-name">First name</Label>
                  <Input
                    id="first-name"
                    type="text"
                    autoComplete="given-name"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Mike"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="last-name">Last name</Label>
                  <Input
                    id="last-name"
                    type="text"
                    autoComplete="family-name"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Rivera"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                />
              </div>
              <Button
                type="submit"
                disabled={sending || !email || !firstName.trim() || !lastName.trim()}
                className="w-full rounded-full"
              >
                {sending ? 'Sending…' : 'Send magic link'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  );
}
