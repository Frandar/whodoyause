import Link from 'next/link';
import { Logo } from '@/components/Logo';

/**
 * Footer from the design reference: dark green brand column plus link columns.
 *
 * Every link here goes somewhere real. The reference's marketing columns
 * (Pricing, About, Careers, Blog) all pointed at "/" — decoys on a product whose
 * entire pitch is trust — so they are omitted until those pages exist, which
 * FRONTEND.md explicitly allows. Privacy and Terms now have real pages and are
 * linked below. Do not re-add a link that points at "/".
 */
const PRODUCT_LINKS = [
  { href: '/browse', label: 'Find a pro' },
  { href: '/recommend', label: 'Recommend a pro' },
  { href: '/#how', label: 'How it works' },
  { href: '/#categories', label: 'Browse categories' },
] as const;

const CATEGORY_LINKS = ['HVAC', 'Plumber', 'Electrician', 'Lawn/Landscaping'] as const;

const COMPANY_LINKS = [
  { href: 'mailto:hello@whodoyause.com', label: 'Contact' },
] as const;

// Bottom legal bar. Kept separate from COMPANY_LINKS so these two aren't
// duplicated in the column above.
const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const;

const footerLink =
  'inline-flex items-center rounded py-1.5 text-[14.5px] text-on-green-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark';

export function Footer() {
  return (
    <footer className="bg-green-deep px-6 pb-8 pt-[clamp(56px,7vw,84px)] text-on-green-body">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="grid grid-cols-1 gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="min-w-[220px]">
            <div className="mb-4">
              <Logo variant="dark" />
            </div>
            <p className="max-w-[280px] text-[14.5px] leading-[1.6] text-on-green-muted">
              Good help, recommended by the people next door. Find trusted local pros without the
              guesswork.
            </p>
          </div>
          <div>
            <div className="mb-3.5 text-sm font-bold text-white">Product</div>
            <div className="flex flex-col gap-2.5">
              {PRODUCT_LINKS.map((link) => (
                <Link key={link.label} href={link.href} className={footerLink}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-3.5 text-sm font-bold text-white">Categories</div>
            <div className="flex flex-col gap-2.5">
              {CATEGORY_LINKS.map((category) => (
                <Link
                  key={category}
                  href={`/browse?category=${encodeURIComponent(category)}`}
                  className={footerLink}
                >
                  {category}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-3.5 text-sm font-bold text-white">Company</div>
            <div className="flex flex-col gap-2.5">
              {COMPANY_LINKS.map((link) =>
                link.href.startsWith('mailto:') ? (
                  <a key={link.label} href={link.href} className={footerLink}>
                    {link.label}
                  </a>
                ) : (
                  <Link key={link.label} href={link.href} className={footerLink}>
                    {link.label}
                  </Link>
                ),
              )}
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3.5 border-t border-white/10 pt-6">
          <p className="text-[13.5px] text-on-green-subtle">
            © {new Date().getFullYear()} WhoDoYaUse. Made for good neighbors.
          </p>
          <div className="flex gap-[22px]">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="inline-flex items-center rounded py-1.5 text-[13.5px] text-on-green-subtle transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
