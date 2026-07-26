import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Recommend a pro',
  description:
    'Pay it forward — add a local business you trust so your neighbors can find them.',
  alternates: { canonical: '/recommend' },
  openGraph: {
    url: '/recommend',
    title: 'Recommend a pro · WhoDoYaUse',
    description:
      'Pay it forward — add a local business you trust so your neighbors can find them.',
  },
};

export default function RecommendLayout({ children }: { children: React.ReactNode }) {
  return children;
}
