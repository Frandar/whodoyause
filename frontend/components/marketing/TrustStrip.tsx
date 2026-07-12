import { Users, ShieldCheck, MessagesSquare } from 'lucide-react';

// Styled after the reference #trust section (eyebrow + centered Bricolage
// headline + white cards + stat band), but the copy stays the real product
// story and the stat band shows real numbers — no invented social proof.
const POINTS = [
  {
    icon: Users,
    title: 'From named neighbors',
    body: 'Every recommendation is attributed to a real community member — not an anonymous review.',
  },
  {
    icon: ShieldCheck,
    title: 'Ranked by endorsements',
    body: 'The more neighbors who +1 a business, the higher it ranks. Trust rises to the top.',
  },
  {
    icon: MessagesSquare,
    title: 'No more re-asking',
    body: 'Find the answer the group already gave, instead of posting the same question again.',
  },
] as const;

export function TrustStrip({
  totalRecommendations,
  categoriesCovered,
}: {
  totalRecommendations: number | null;
  categoriesCovered?: number;
}) {
  const showStats = totalRecommendations !== null && totalRecommendations > 0;

  return (
    <section id="trust" className="bg-background px-6 py-[clamp(64px,8vw,104px)]">
      <div className="mx-auto w-full max-w-[1200px]">
        <div data-reveal className="mx-auto mb-12 max-w-[640px] text-center">
          <p className="mb-3.5 text-[13.5px] font-bold uppercase tracking-[0.08em] text-[#8a9a8f]">
            Word of mouth, organized
          </p>
          <h2 className="text-balance font-display text-[clamp(30px,4vw,44px)] font-extrabold leading-[1.08] tracking-[-0.02em] text-primary">
            The advice you&rsquo;d get over the fence — searchable.
          </h2>
        </div>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[22px]">
          {POINTS.map(({ icon: Icon, title, body }, i) => (
            <li
              key={title}
              data-reveal
              data-reveal-delay={i * 90}
              className="rounded-[var(--radius)] border border-[rgb(20_40_30/0.08)] bg-white p-[26px] hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)]"
            >
              <span className="flex size-12 items-center justify-center rounded-[14px] bg-secondary text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mb-2 mt-5 font-display text-xl font-bold text-foreground">{title}</h3>
              <p className="text-[15.5px] leading-[1.6] text-[#52635a]">{body}</p>
            </li>
          ))}
        </ul>
        {showStats && (
          // No data-reveal here: this block mounts after the fetch resolves,
          // past RevealObserver's mount-time scan, so it would never reveal.
          <div className="mt-[54px] flex flex-wrap justify-center gap-[clamp(28px,6vw,72px)] border-t border-[rgb(20_40_30/0.1)] pt-[42px]">
            <div className="text-center">
              <div className="font-display text-[clamp(30px,3.4vw,42px)] font-extrabold leading-none text-primary">
                {totalRecommendations.toLocaleString()}
              </div>
              <div className="mt-1.5 text-sm text-[#6a786f]">
                recommendation{totalRecommendations === 1 ? '' : 's'}
              </div>
            </div>
            {categoriesCovered !== undefined && categoriesCovered > 0 && (
              <div className="text-center">
                <div className="font-display text-[clamp(30px,3.4vw,42px)] font-extrabold leading-none text-primary">
                  {categoriesCovered}
                </div>
                <div className="mt-1.5 text-sm text-[#6a786f]">
                  categor{categoriesCovered === 1 ? 'y' : 'ies'} covered
                </div>
              </div>
            )}
            <div className="text-center">
              <div className="font-display text-[clamp(30px,3.4vw,42px)] font-extrabold leading-none text-primary">
                1
              </div>
              <div className="mt-1.5 text-sm text-[#6a786f]">neighborhood</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
