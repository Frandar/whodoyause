import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Served with a real 404 status via the CloudFront error mapping in
// infra/hosting.yaml — see the CustomErrorResponses note there.
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <p className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-ink-eyebrow">
        404
      </p>
      <h1 className="font-display text-2xl font-extrabold text-primary">
        That page isn&rsquo;t here
      </h1>
      <p className="text-[15px] leading-[1.6] text-ink-muted">
        The link may be old or mistyped. The recommendations are all still next door.
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <Button asChild className="rounded-full">
          <Link href="/browse">Find a pro</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
