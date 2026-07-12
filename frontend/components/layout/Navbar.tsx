'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { Logo } from '@/components/Logo';

// Reference nav links (anchors on the homepage) plus the real recommend flow.
const NAV_LINKS = [
  { href: '/#how', label: 'How it works' },
  { href: '/#categories', label: 'Categories' },
  { href: '/recommend', label: 'Recommend a pro' },
] as const;

export function Navbar() {
  const { signedIn, email, signOut, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b bg-[rgb(250_246_239/0.92)] backdrop-blur-xl backdrop-saturate-[1.8] transition-[box-shadow,border-color] duration-300',
        scrolled
          ? 'border-[rgb(20_40_30/0.10)] shadow-[0_10px_30px_-22px_rgb(8_30_22/0.55)]'
          : 'border-transparent',
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex w-full max-w-[1200px] items-center gap-3 px-4 py-[15px] min-[880px]:gap-[22px] min-[880px]:px-6"
      >
        <Logo variant="light" />

        {/* Desktop nav (reference hides links below 880px) */}
        <div className="ml-[18px] hidden gap-[30px] min-[880px]:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded text-[15px] font-semibold text-[#3c4b44] transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3.5">
          {loading ? null : signedIn ? (
            <button
              type="button"
              onClick={() => signOut()}
              className="hidden rounded text-[15px] font-bold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-[880px]:inline-flex"
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/signin"
              className="hidden rounded text-[15px] font-bold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-[880px]:inline-flex"
            >
              Log in
            </Link>
          )}
          <Link
            href="/browse"
            className="rounded-full bg-amber px-5 py-[11px] text-[15px] font-bold text-amber-foreground shadow-[0_8px_18px_-8px_rgb(8_30_22/0.45)] transition-all duration-[250ms] hover:-translate-y-0.5 hover:brightness-[1.04] hover:shadow-[0_12px_22px_-8px_rgb(8_30_22/0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Find a pro
          </Link>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="inline-flex size-[42px] items-center justify-center rounded-xl border border-[rgb(20_40_30/0.14)] bg-white text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-[880px]:hidden"
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div id="mobile-menu" className="min-[880px]:hidden">
          <div className="flex flex-col gap-1 px-[18px] pb-[18px] pt-1.5">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-base font-semibold text-[#22332c] transition-colors hover:bg-[rgb(20_40_30/0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {link.label}
              </Link>
            ))}
            {loading ? null : signedIn ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="rounded-xl px-3 py-3 text-left text-base font-semibold text-[#22332c] transition-colors hover:bg-[rgb(20_40_30/0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Sign out{email ? ` (${email})` : ''}
              </button>
            ) : (
              <Link
                href="/signin"
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-base font-semibold text-[#22332c] transition-colors hover:bg-[rgb(20_40_30/0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Log in
              </Link>
            )}
            <Link
              href="/browse"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-full bg-amber p-3.5 text-center text-base font-bold text-amber-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Find a pro
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
