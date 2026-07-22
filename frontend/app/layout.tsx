import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { Navbar } from '@/components/navbar';
import { AuthModal } from '@/features/auth/components/auth-modal';
import { ApplyModal } from '@/features/applications/components/apply-modal';
import { AuthProvider } from '@/components/auth-provider';

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
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <Navbar />
          <AuthModal />
          <ApplyModal />
          <Toaster richColors position="top-center" />
          <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}