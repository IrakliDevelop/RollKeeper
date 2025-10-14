import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { RealtimeProvider } from '@/contexts/RealtimeContext';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Rollkeeper',
  description: 'Rollkeeper is a character sheet for the game of D&D 5e.',
  icons: {
    icon: '/rollkeeper_favicon.svg',
    shortcut: '/rollkeeper_favicon.svg',
    apple: '/rollkeeper_favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        <ErrorBoundary>
          <AuthProvider>
            <RealtimeProvider>
              {children}
            </RealtimeProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
