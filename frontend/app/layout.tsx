import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { Navbar } from '@/components/navbar';
import { AuthModal } from '@/features/auth/components/auth-modal';
import { ApplyModal } from '@/features/applications/components/apply-modal';
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bs">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased`}
      >
        <QueryProvider>
          <AuthProvider>
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
