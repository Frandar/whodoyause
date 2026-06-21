import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function CTASection() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12">
      <div className="flex flex-col items-center gap-5 rounded-[var(--radius)] border border-border bg-primary px-6 py-14 text-center shadow-soft">
        <h2 className="max-w-xl text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Know a great local pro?
        </h2>
        <p className="max-w-md text-balance text-white/70">
          Add them in seconds and help the next neighbor skip the search.
        </p>
        <Button asChild size="lg" variant="amber" className="mt-1 rounded-full">
          <Link href="/recommend">Recommend a pro</Link>
        </Button>
      </div>
    </section>
  );
}
