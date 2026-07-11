import Link from 'next/link';
import { Logo } from '@/components/Logo';

/**
 * Footer from the design reference: dark green (#102e28), brand column plus
 * three link columns, legal bar below. Marketing-only entries (Pricing, About,
 * Careers, Blog, Privacy/Terms/Cookies) are static and point home, mirroring
 * the reference's #top anchors, until real pages exist.
 */
const PRODUCT_LINKS = [
  { href: '/#how', label: 'How it works' },
  { href: '/#categories', label: 'Browse categories' },
  { href: '/#pros', label: 'For pros' },
  { href: '/', label: 'Pricing' },
] as const;

const CATEGORY_LINKS = ['HVAC', 'Plumber', 'Electrician', 'Lawn/Landscaping'] as const;

const COMPANY_LINKS = [
  { href: '/', label: 'About' },
  { href: '/', label: 'Careers' },
  { href: 'mailto:hello@whodoyause.com', label: 'Contact' },
  { href: '/', label: 'Blog' },
] as const;

const LEGAL_LINKS = ['Privacy', 'Terms', 'Cookies'] as const;

const footerLink =
  'rounded text-[14.5px] text-[#9fb6ab] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function Footer() {
  return (
    <footer className="bg-[#102e28] px-6 pb-8 pt-[clamp(56px,7vw,84px)] text-[#cdddd4]">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="grid grid-cols-1 gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="min-w-[220px]">
            <div className="mb-4">
              <Logo variant="dark" />
            </div>
            <p className="max-w-[280px] text-[14.5px] leading-[1.6] text-[#9fb6ab]">
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
          <p className="text-[13.5px] text-[#7f968b]">
            © {new Date().getFullYear()} WhoDoYaUse. Made for good neighbors.
          </p>
          <div className="flex gap-[22px]">
            {LEGAL_LINKS.map((label) => (
              <Link
                key={label}
                href="/"
                className="rounded text-[13.5px] text-[#7f968b] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
