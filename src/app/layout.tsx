import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import { AccountIndicator } from '@/components/auth/AccountIndicator';
import { ThemeProviderWrapper } from './ThemeProviderWrapper';
import { PersistenceBootstrap } from '@/components/PersistenceBootstrap';

const geistSans = localFont({
  src: './fonts/geist-latin.woff2',
  variable: '--font-geist-sans',
  weight: '100 900',
  display: 'swap',
});

const geistMono = localFont({
  src: './fonts/geist-mono-latin.woff2',
  variable: '--font-geist-mono',
  weight: '100 900',
  display: 'swap',
});

const cinzelDecorative = localFont({
  src: [
    { path: './fonts/cinzel-decorative-400-latin.woff2', weight: '400' },
    { path: './fonts/cinzel-decorative-700-latin.woff2', weight: '700' },
    { path: './fonts/cinzel-decorative-900-latin.woff2', weight: '900' },
  ],
  variable: '--font-cinzel-decorative',
  display: 'swap',
});

const bricolage = localFont({
  src: './fonts/bricolage-grotesque-latin.woff2',
  variable: '--font-bricolage',
  weight: '600 800',
  display: 'swap',
});

const hanken = localFont({
  src: './fonts/hanken-grotesk-latin.woff2',
  variable: '--font-hanken',
  weight: '400 800',
  display: 'swap',
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

/**
 * Inline script that runs BEFORE React hydrates to prevent
 * a flash of wrong theme (FOUC). It reads localStorage or
 * the system preference and sets data-theme on <html>.
 */
const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('rollkeeper-theme');
    var theme = stored === 'dark' || stored === 'light' || stored === 'parchment' ? stored : null;
    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (theme !== 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cinzelDecorative.variable} ${bricolage.variable} ${hanken.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        <ThemeProviderWrapper>
          <PersistenceBootstrap>
            <ErrorBoundary>
              {children}
              <AccountIndicator />
            </ErrorBoundary>
          </PersistenceBootstrap>
        </ThemeProviderWrapper>
      </body>
    </html>
  );
}
