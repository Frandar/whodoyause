import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Bricolage_Grotesque } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { AnalyticsProvider } from '@/components/AnalyticsProvider';
import { AuthProvider } from '@/components/AuthProvider';
import { Navbar } from '@/components/layout/Navbar';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

// NEXT_PUBLIC_SITE_URL is the CloudFront (or custom) origin. metadataBase makes
// every relative OG/canonical URL absolute — without it Next emits relative
// og:image paths, which Facebook silently ignores.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://whodoyause.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // %s is filled by each route's own title; the bare landing page uses default.
  title: {
    default: 'WhoDoYaUse — Local pros your neighbors actually recommend',
    template: '%s · WhoDoYaUse',
  },
  description:
    'Search local businesses recommended by named neighbors, not anonymous reviews. Find a plumber, electrician, HVAC tech or lawn crew your street already trusts.',
  applicationName: 'WhoDoYaUse',
  alternates: { canonical: '/' },
  // The GTM channel is Facebook posts (PRD §4), so the share card is not a
  // nice-to-have — it is the first impression for most visitors.
  openGraph: {
    type: 'website',
    siteName: 'WhoDoYaUse',
    url: '/',
    title: 'WhoDoYaUse — Local pros your neighbors actually recommend',
    description:
      'The advice you’d get over the fence — searchable. Recommended by your neighbors, not algorithms.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WhoDoYaUse — Local pros your neighbors actually recommend',
    description:
      'The advice you’d get over the fence — searchable. Recommended by your neighbors, not algorithms.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${bricolage.variable}`}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {/* Skip link (WCAG 2.4.1). Visually hidden until focused, then it lands
            as a normal pill button over the header. Must be the first focusable
            element in the document. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-5 focus:py-3 focus:text-[15px] focus:font-bold focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Skip to content
        </a>
        <AnalyticsProvider />
        <AuthProvider>
          <div className="flex min-h-dvh flex-col">
            <Navbar />
            {/* The single main landmark for every route. Pages render their own
                sections inside this — they must NOT nest another <main>. */}
            <main id="main" className="flex-1">
              {children}
            </main>
          </div>
        </AuthProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
