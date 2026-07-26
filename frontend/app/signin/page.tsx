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

type Mode = 'signup' | 'login';

function SignInInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const { signedIn, loading, sendMagicLink } = useAuth();

  // Default to signup (name capture is the point); ?mode=login targets returning
  // users. Login asks for email only — no re-entering your name every visit.
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'login' ? 'login' : 'signup');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const isSignup = mode === 'signup';

  // Already signed in → there's nothing to do here; go where they were headed.
  useEffect(() => {
    if (!loading && signedIn) router.replace(next);
  }, [loading, signedIn, next, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    // Pass `next` through so the emailed link returns the neighbor to what they
    // were trying to do, not to the site root.
    const result = await sendMagicLink(
      email,
      isSignup ? { firstName, lastName } : undefined,
      next,
    );
    setSending(false);
    if (result.ok) {
      setSent(true);
    } else if (result.rateLimited) {
      toast.error('Too many sign-in emails', {
        description: 'Wait a minute and try again, or use the link already sent.',
      });
    } else if (result.notFound) {
      toast.error('No account found', {
        description: "We couldn't find an account for that email — create one below.",
      });
      setMode('signup');
    } else {
      toast.error("Couldn't send the link", { description: result.message });
    }
  }

  const disabled =
    sending || !email || (isSignup && (!firstName.trim() || !lastName.trim()));

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      {sent ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-primary">
              <MailCheck className="size-5" aria-hidden />
            </span>
            <p className="font-semibold">Check your email</p>
            <p className="text-sm text-muted-foreground">
              We sent a magic link to {email}. Open it on this device to finish
              {isSignup ? ' signing up' : ' logging in'}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            {/* asChild so the page's visible title is a real <h1>. CardTitle
                renders a <div> by default, which left /signin with no headings
                at all (WCAG 1.3.1 / 2.4.6). */}
            <CardTitle asChild>
              <h1 className="font-display text-xl font-bold">
                {isSignup ? 'Create your account' : 'Log in'}
              </h1>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {isSignup ? (
                  <>
                    Your name is what neighbors see on your recommendations (shown as
                    &ldquo;Mike R.&rdquo;) — we never show your email.
                  </>
                ) : (
                  <>Enter your email and we&apos;ll send a magic link — no password.</>
                )}
              </p>
              {isSignup && (
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
              )}
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
              <Button type="submit" disabled={disabled} className="w-full rounded-full">
                {sending ? 'Sending…' : isSignup ? 'Send sign-up link' : 'Send magic link'}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              {isSignup ? 'Already have an account?' : 'New here?'}{' '}
              <button
                type="button"
                onClick={() => setMode(isSignup ? 'login' : 'signup')}
                className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                {isSignup ? 'Log in' : 'Create an account'}
              </button>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  );
}
