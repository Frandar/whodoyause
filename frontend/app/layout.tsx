import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
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

export const metadata: Metadata = {
  title: 'WhoDoYaUse',
  description: 'Trusted local business recommendations from your neighbors.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
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
