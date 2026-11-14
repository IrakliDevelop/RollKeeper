import type { Metadata } from 'next';
import './globals.css';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import { ThemeProviderWrapper } from './ThemeProviderWrapper';
import { MotionProvider } from './MotionProvider';
import { PersistenceBootstrap } from '@/components/PersistenceBootstrap';
import { StorageBlockedBanner } from '@/components/ui/feedback/StorageBlockedBanner';
import { ConfirmDialogHost } from '@/components/ui/feedback/confirm-dialog';
import { storageFallbackScript } from '@/lib/browserStorage';
import { themeScript } from './themeScript';
import { FONT_VARIABLES } from './fonts';

export const metadata: Metadata = {
  title: 'Rollkeeper',
  description: 'Rollkeeper is a character sheet for the game of D&D 5e.',
  icons: {
    icon: '/rollkeeper_favicon.svg',
    shortcut: '/rollkeeper_favicon.svg',
    apple: '/apple-touch-icon.png',
  },
};

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
        {/* First, so no later script reads storage the browser refuses. */}
        <script dangerouslySetInnerHTML={{ __html: storageFallbackScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          dangerouslySetInnerHTML={{ __html: characterPersistenceScript }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning={true}>
        <ThemeProviderWrapper>
          <MotionProvider>
            <StorageBlockedBanner />
            <PersistenceBootstrap>
              <ErrorBoundary>{children}</ErrorBoundary>
            </PersistenceBootstrap>
            {/* Outside PersistenceBootstrap, which renders nothing until
                storage is ready, because its providers open dialogs too. */}
            <ConfirmDialogHost />
          </MotionProvider>
        </ThemeProviderWrapper>
      </body>
    </html>
  );
}
