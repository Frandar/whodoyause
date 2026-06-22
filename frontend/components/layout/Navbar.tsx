'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';

const NAV_LINKS = [
  { href: '/browse', label: 'Browse' },
  { href: '/recommend', label: 'Recommend a pro' },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const { signedIn, email, signOut, loading } = useAuth();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-40 bg-primary">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4"
      >
        <Logo variant="dark" />

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                isActive(link.href)
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white',
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="ml-2">
            {loading ? null : signedIn ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="text-white/70 hover:bg-white/10 hover:text-white"
              >
                Sign out
              </Button>
            ) : (
              <Button asChild size="sm" variant="amber" className="rounded-full">
                <Link href="/signin">Sign in</Link>
              </Button>
            )}
          </div>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="inline-flex size-9 items-center justify-center rounded-md text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 md:hidden"
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div id="mobile-menu" className="border-t border-white/10 bg-primary md:hidden">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                  isActive(link.href)
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white',
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-1 border-t border-white/10 pt-2">
              {loading ? null : signedIn ? (
                <div className="flex flex-col gap-2">
                  {email && (
                    <p className="px-3 text-xs text-white/50">Signed in as {email}</p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setOpen(false); signOut(); }}
                    className="w-full rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    Sign out
                  </Button>
                </div>
              ) : (
                <Button asChild size="sm" variant="amber" className="w-full rounded-full">
                  <Link href="/signin" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
