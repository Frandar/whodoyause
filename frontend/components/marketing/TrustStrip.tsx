import { Users, ShieldCheck, MessagesSquare } from 'lucide-react';

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
}: {
  totalRecommendations: number | null;
}) {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12">
      {totalRecommendations !== null && totalRecommendations > 0 && (
        <p className="mb-8 text-center text-sm font-medium text-muted-foreground">
          {totalRecommendations.toLocaleString()} neighbor recommendation
          {totalRecommendations === 1 ? '' : 's'} and counting.
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-3">
        {POINTS.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)]"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-primary">
              <Icon className="size-4" aria-hidden />
            </span>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
