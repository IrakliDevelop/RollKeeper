import type { Metadata } from 'next';
import { Geist, Geist_Mono, Cinzel_Decorative } from 'next/font/google';
import './globals.css';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import { ThemeProviderWrapper } from './ThemeProviderWrapper';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const cinzelDecorative = Cinzel_Decorative({
  variable: '--font-cinzel-decorative',
  subsets: ['latin'],
  weight: ['400', '700', '900'],
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
    var theme = stored === 'dark' || stored === 'light' ? stored : null;
    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
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
        className={`${geistSans.variable} ${geistMono.variable} ${cinzelDecorative.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        <ThemeProviderWrapper>
          <ErrorBoundary>{children}</ErrorBoundary>
        </ThemeProviderWrapper>
      </body>
    </html>
  );
}
