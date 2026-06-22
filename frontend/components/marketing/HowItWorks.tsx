const STEPS = [
  {
    n: 1,
    title: 'Search or browse',
    body: 'Look up a category like "plumber" or browse what neighbors already recommend.',
  },
  {
    n: 2,
    title: 'See who they trust',
    body: 'Each result shows the business, who recommended it, and how many neighbors +1\'d it.',
  },
  {
    n: 3,
    title: 'Add or +1 your own',
    body: 'Sign in to recommend a pro you trust, or +1 one that\'s already listed.',
  },
] as const;

export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12">
      <div className="text-center">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
          How it works
        </p>
        <h2 className="text-balance font-display text-3xl font-extrabold leading-[1.06] tracking-[-0.02em] text-primary sm:text-4xl">
          Three steps from &ldquo;who do ya use?&rdquo; to booked.
        </h2>
      </div>
      <ol className="mt-10 grid gap-4 sm:grid-cols-3">
        {STEPS.map((step) => (
          <li
            key={step.n}
            className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)]"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-amber text-amber-foreground text-sm font-bold">
              {step.n}
            </span>
            <h3 className="font-semibold">{step.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
