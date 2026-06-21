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

export const metadata: Metadata = {
  title: 'WhoDoYaUse',
  description: 'Good help, recommended by the people next door.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${bricolage.variable}`}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <AnalyticsProvider />
        <AuthProvider>
          <div className="flex min-h-dvh flex-col">
            <Navbar />
            <div className="flex-1">{children}</div>
          </div>
        </AuthProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
