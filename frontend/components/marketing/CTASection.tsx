import Link from 'next/link';

/**
 * Full-bleed green closing band from the design reference (#pros section).
 * The secondary CTA maps to the real MVP action (recommend) instead of the
 * reference's "List your business", which has no page yet.
 */
export function CTASection() {
  return (
    <section
      id="pros"
      className="relative overflow-hidden bg-primary px-6 py-[clamp(64px,8vw,116px)] text-white"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-[140px] -left-[100px] size-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgb(255_255_255/0.07),transparent_65%)]"
      />
      <div data-reveal className="relative mx-auto max-w-[760px] text-center">
        <h2 className="text-balance font-display text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.04] tracking-[-0.025em]">
          Your neighbors already found the good ones.
        </h2>
        <p className="mx-auto mb-[34px] mt-[18px] max-w-[540px] text-[clamp(17px,1.6vw,20px)] leading-[1.6] text-[#c7dccf]">
          Tell us your neighborhood and what you need. We&rsquo;ll show you who&rsquo;s trusted
          right down your street.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3.5 max-[880px]:flex-col max-[880px]:items-stretch">
          <Link
            href="/browse"
            className="rounded-full bg-amber px-[34px] py-[17px] text-[17px] font-bold text-amber-foreground shadow-[0_18px_36px_-16px_rgb(0_0_0/0.55)] transition-all duration-[250ms] hover:-translate-y-[3px] hover:brightness-105 hover:shadow-[0_24px_44px_-16px_rgb(0_0_0/0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Find a pro near you
          </Link>
          <Link
            href="/recommend"
            className="rounded-full border-[1.5px] border-white/[0.28] px-[26px] py-4 text-base font-bold text-[#eaf3ee] transition-colors duration-[250ms] hover:border-white/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Recommend a pro
          </Link>
        </div>
        <p className="mt-[22px] text-sm text-[#9fbcae]">Free to use · No spam · Real neighbors only</p>
      </div>
    </section>
  );
}
