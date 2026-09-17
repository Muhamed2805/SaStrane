import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { Navbar } from '@/components/navbar';
import { AuthModal } from '@/features/auth/components/auth-modal';
import { ApplyModal } from '@/features/applications/components/apply-modal';
import { AuthProvider } from '@/components/auth-provider';
import { Footer } from '@/components/footer';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'SaStrane',
  description: 'Lokalni marketplace za side-hustle poslove',
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
        <AuthProvider>
          <Navbar />
          <AuthModal />
          <ApplyModal />
          <Toaster richColors position="top-center" />
          <main className="site-container flex-1 py-8">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
