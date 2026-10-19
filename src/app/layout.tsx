import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import { ThemeProviderWrapper } from './ThemeProviderWrapper';
import { MotionProvider } from './MotionProvider';
import { PersistenceBootstrap } from '@/components/PersistenceBootstrap';

// Felt and Brass type: Vollkorn for headings, Barlow for body and UI,
// Barlow Condensed for display numerals. Self-hosted latin subsets from
// Fontsource 5.3.0 (SIL OFL 1.1, see ./fonts/README.md).
const vollkorn = localFont({
  src: './fonts/vollkorn-latin-wght-normal.woff2',
  variable: '--font-vollkorn',
  weight: '400 900',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
});

const barlow = localFont({
  src: [
    {
      path: './fonts/barlow-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/barlow-latin-400-italic.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: './fonts/barlow-latin-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/barlow-latin-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
  variable: '--font-barlow',
  display: 'swap',
});

const barlowCondensed = localFont({
  src: [
    {
      path: './fonts/barlow-condensed-latin-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: './fonts/barlow-condensed-latin-700-normal.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-barlow-condensed',
  display: 'swap',
});

// The font variables live on <html> so the theme tokens declared on :root
// (--font-body-family and friends) can resolve them.
const FONT_VARIABLES = `${vollkorn.variable} ${barlow.variable} ${barlowCondensed.variable}`;

export const metadata: Metadata = {
  title: 'Rollkeeper',
  description: 'Rollkeeper is a character sheet for the game of D&D 5e.',
  icons: {
    icon: '/rollkeeper_favicon.svg',
    shortcut: '/rollkeeper_favicon.svg',
    apple: '/apple-touch-icon.png',
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

const characterPersistenceScript =
  process.env.NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED === 'true'
    ? `
(function() {
  try {
    var raw = localStorage.getItem('rollkeeper:indexeddb-selection:guest:character');
    var selection = raw ? JSON.parse(raw) : null;
    if (selection && typeof selection.activatedEpoch === 'number' && typeof selection.activatedGeneration === 'string') {
      document.documentElement.setAttribute('data-character-persistence-pending', 'true');
      document.documentElement.style.visibility = 'hidden';
    }
  } catch (e) {}
})();
`
    : '';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={FONT_VARIABLES} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          dangerouslySetInnerHTML={{ __html: characterPersistenceScript }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning={true}>
        <ThemeProviderWrapper>
          <MotionProvider>
            <PersistenceBootstrap>
              <ErrorBoundary>{children}</ErrorBoundary>
            </PersistenceBootstrap>
          </MotionProvider>
        </ThemeProviderWrapper>
      </body>
    </html>
  );
}
