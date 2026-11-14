'use client';

import { useEffect } from 'react';
import './globals.css';
import ErrorPage, { ERROR_PAGE_COPY } from '@/components/ui/feedback/ErrorPage';
import { FONT_VARIABLES } from './fonts';
import { themeScript } from './themeScript';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

// Keep in step with themeScript.ts; read-only, themeScript already migrates
// parchment. React never runs the inline script when it renders this page on
// the client, so the stored theme is applied again on mount.
function applyStoredTheme(): void {
  const root = document.documentElement;
  try {
    const stored = localStorage.getItem('rollkeeper-theme');
    let theme: string;
    if (stored === 'dark' || stored === 'blue') theme = stored;
    else if (stored === 'light' || stored === 'parchment') theme = 'light';
    else
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    if (theme === 'light') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  } catch {
    // Storage or matchMedia refused: keep the light theme.
  }
}

export default function GlobalError({ error }: GlobalErrorProps) {
  useEffect(() => {
    applyStoredTheme();
  }, []);

  return (
    <html lang="en" className={FONT_VARIABLES} suppressHydrationWarning>
      <head>
        <title>{ERROR_PAGE_COPY.global.heading}</title>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <ErrorPage
          kind="global"
          error={error}
          onRetry={() => window.location.reload()}
        />
      </body>
    </html>
  );
}
