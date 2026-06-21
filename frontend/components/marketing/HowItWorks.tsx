const STEPS = [
  {
    n: 1,
    title: 'Search or browse',
    body: 'Look up a category like “plumber” or browse what neighbors already recommend.',
  },
  {
    n: 2,
    title: 'See who they trust',
    body: 'Each result shows the business, who recommended it, and how many neighbors +1’d it.',
  },
  {
    n: 3,
    title: 'Add or +1 your own',
    body: 'Sign in to recommend a pro you trust, or +1 one that’s already listed.',
  },
] as const;

export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10">
      <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
        How it works
      </h2>
      <ol className="mt-8 grid gap-4 sm:grid-cols-3">
        {STEPS.map((step) => (
          <li
            key={step.n}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-6 shadow-soft"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {step.n}
            </span>
            <h3 className="font-semibold">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
