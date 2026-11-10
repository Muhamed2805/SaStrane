import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { Navbar } from '@/components/navbar';
import { AuthModal } from '@/features/auth/components/auth-modal';
import { ApplyModal } from '@/features/applications/components/apply-modal';
import { LiveEvents } from '@/features/live/components/live-events';
import { AuthProvider } from '@/components/auth-provider';
import { QueryProvider } from '@/components/query-provider';
import { Footer } from '@/components/footer';
import { BASE_OPEN_GRAPH, SITE_NAME, SITE_URL } from '@/lib/site';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const DESCRIPTION =
  'Lokalni poslovi u tvojoj blizini: objavi posao ili zaradi sa strane uz košenje trave, selidbe, čišćenje i druge poslove po Bosni i Hercegovini.';

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME} – lokalni poslovi u tvojoj blizini`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  // The title and description fill in the preview of every page.
  openGraph: { ...BASE_OPEN_GRAPH, type: 'website' },
  // The large picture of app/opengraph-image.tsx, or a job's cover photo.
  twitter: { card: 'summary_large_image' },
  // The address is in a link, not a phone number to call.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: '#0f9f91' };

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Every page is rendered for its request: only then can its scripts carry
  // the nonce of that request's Content-Security-Policy (see proxy.ts). A
  // page built ahead of time would have scripts the browser refuses.
  await connection();

  return (
    <html lang="bs">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased`}
      >
        <QueryProvider>
          <AuthProvider>
            <LiveEvents />
            <Navbar />
            <AuthModal />
            <ApplyModal />
            <Toaster richColors position="top-center" />
            <main className="site-container flex-1 py-8">{children}</main>
            <Footer />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
