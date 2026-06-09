import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WhoDoYaUse',
  description: 'Neighbor-sourced local business recommendations',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '40px auto', padding: '0 16px' }}>
        {children}
      </body>
    </html>
  );
}
