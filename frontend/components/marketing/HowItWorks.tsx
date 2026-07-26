// Layout matches the design reference (#how section). The COPY deliberately
// does not: the reference is a marketing mock that promises booking, messaging
// and a neighborhood picker, none of which exist and all of which are explicit
// non-scope (PRD §7, FRONTEND.md "Challenge any request to build booking").
// Promising them set first-visit expectations the product cannot meet, which is
// precisely the kind of thing that poisons the 7-day-return signal M4 measures.
// These three steps describe what the MVP actually does.
const STEPS = [
  {
    n: 1,
    title: 'Search what you need',
    body: 'Type the job or tap a category. Everything you see comes from your own neighborhood.',
  },
  {
    n: 2,
    title: 'See who neighbors use',
    body: 'Every pro shows real recommendations from people nearby — who vouched for them, how many, and why.',
  },
  {
    n: 3,
    title: 'Call them, then pay it forward',
    body: 'Get in touch using the details your neighbor shared. Afterward, +1 the ones you’d send next door.',
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 bg-surface-band px-6 py-[clamp(64px,8vw,112px)]">
      <div className="mx-auto w-full max-w-[1200px]">
        <div data-reveal className="mb-[52px] max-w-[620px]">
          <p className="mb-3.5 text-[13.5px] font-bold uppercase tracking-[0.08em] text-ink-eyebrow">
            How it works
          </p>
          <h2 className="mb-4 text-balance font-display text-[clamp(30px,4vw,46px)] font-extrabold leading-[1.06] tracking-[-0.02em] text-primary">
            Three steps from &ldquo;who do ya use?&rdquo; to a name you trust.
          </h2>
          <p className="max-w-[520px] text-[17px] leading-[1.6] text-ink-subtle">
            No bidding wars, no cold leads. Just the names your street already stands behind.
          </p>
        </div>
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-[22px]">
          {STEPS.map((step, i) => (
            <li
              key={step.n}
              data-reveal
              data-reveal-delay={i * 100}
              className="rounded-[var(--radius)] border border-[rgb(20_40_30/0.06)] bg-white px-[26px] py-[30px] hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)]"
            >
              <span className="flex size-12 items-center justify-center rounded-[14px] bg-primary font-display text-xl font-extrabold text-white">
                {step.n}
              </span>
              <h3 className="mb-2 mt-5 font-display text-xl font-bold text-foreground">
                {step.title}
              </h3>
              <p className="text-[15.5px] leading-[1.6] text-ink-subtle">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
