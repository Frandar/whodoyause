import type { Metadata } from 'next';

// /browse is a client component and so cannot export metadata itself. This
// server layout supplies it — same trick for /recommend and /signin.
export const metadata: Metadata = {
  title: 'Find a pro',
  description:
    'Search or browse local pros by category — every recommendation comes from a named neighbor.',
  alternates: { canonical: '/browse' },
  openGraph: {
    url: '/browse',
    title: 'Find a pro · WhoDoYaUse',
    description:
      'Search or browse local pros by category — every recommendation comes from a named neighbor.',
  },
};

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
