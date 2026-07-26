import type { ReactNode } from 'react';

// Shared shell for the plain-language legal pages. Server component — these are
// static content and must render without JS so they're always reachable.
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-4 py-[clamp(48px,7vw,80px)]">
      <header className="flex flex-col gap-3">
        <p className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-ink-eyebrow">
          The fine print, in plain English
        </p>
        <h1 className="font-display text-[clamp(30px,5vw,44px)] font-extrabold leading-[1.06] tracking-[-0.02em] text-primary">
          {title}
        </h1>
        <p className="text-sm text-ink-muted">Last updated {updated}</p>
        <div className="text-[16.5px] leading-[1.65] text-ink-subtle">{intro}</div>
      </header>
      <div className="flex flex-col gap-7">{children}</div>
    </article>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-[21px] font-bold text-primary">{heading}</h2>
      <div className="flex flex-col gap-3 text-[16px] leading-[1.65] text-ink-subtle">
        {children}
      </div>
    </section>
  );
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-ink-muted">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
