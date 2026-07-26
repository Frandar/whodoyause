'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Route-level error boundary. Without one, any render-time throw (a malformed
// API payload, a missing env var) left a blank white page with nothing in the
// UI to recover from.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced to Sentry when a DSN is configured; always visible in the console.
    console.error('Unhandled render error:', error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-extrabold text-primary">
        Something went wrong on our end
      </h1>
      <p className="text-[15px] leading-[1.6] text-ink-muted">
        This one&rsquo;s on us, not you. Try again — and if it keeps happening, let us know.
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <Button className="rounded-full" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
