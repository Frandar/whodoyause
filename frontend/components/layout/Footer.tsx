import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-primary">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-base font-bold tracking-tight text-white">WhoDoYaUse</span>
          <p className="text-sm text-white/60">
            Good help, recommended by the people next door.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link
            href="/browse"
            className="rounded text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            Browse
          </Link>
          <Link
            href="/recommend"
            className="rounded text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            Recommend a pro
          </Link>
          <a
            href="mailto:hello@whodoyause.com"
            className="rounded text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            Contact
          </a>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-white/40">
          © {new Date().getFullYear()} WhoDoYaUse. Made for good neighbors.
        </p>
      </div>
    </footer>
  );
}
