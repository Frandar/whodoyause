import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Brand mark from the approved design file (WhoDoYaUse Home.html): a rounded
 * square chip cradling a glowing amber dot, beside the Bricolage wordmark.
 *
 * `dark`  — for green/dark surfaces (navbar, footer): translucent chip, white wordmark.
 * `light` — for cream/light surfaces: solid forest-green chip, green wordmark.
 */
export function Logo({
  variant = 'dark',
  className,
}: {
  variant?: 'dark' | 'light';
  className?: string;
}) {
  const onDark = variant === 'dark';

  return (
    <Link
      href="/"
      aria-label="WhoDoYaUse home"
      className={cn(
        'group inline-flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2',
        onDark ? 'focus-visible:ring-white/50' : 'focus-visible:ring-ring',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-[34px] items-center justify-center rounded-xl shadow-[0_4px_10px_-4px_rgb(8_30_22/0.6)] transition-transform duration-300 group-hover:-translate-y-0.5',
          onDark ? 'bg-white/10' : 'bg-primary',
        )}
        aria-hidden
      >
        <span className="size-3 rounded-full bg-amber shadow-[0_0_0_3px_rgb(255_194_61/0.25)]" />
      </span>
      <span
        className={cn(
          'font-display text-xl font-extrabold tracking-[-0.01em]',
          onDark ? 'text-white' : 'text-primary',
        )}
      >
        WhoDoYaUse
      </span>
    </Link>
  );
}
