'use client';

import { Button } from '@/components/ui/forms/button';

export type ErrorPageKind = 'not-found' | 'route' | 'global';

export interface ErrorPageProps {
  kind: ErrorPageKind;
  error?: Error;
  onRetry?: () => void;
}

export const ERROR_PAGE_COPY: Record<
  ErrorPageKind,
  { heading: string; lines: readonly [string, string] }
> = {
  'not-found': {
    heading: 'Page not found',
    lines: ["There's no page at this address.", 'Check the link, or go home.'],
  },
  route: {
    heading: 'This page hit an error',
    lines: [
      "Saved characters and campaigns on this device aren't affected.",
      "Try again. If that doesn't help, go home and open the page from there.",
    ],
  },
  global: {
    heading: 'RollKeeper hit an error',
    lines: [
      "Saved characters and campaigns on this device aren't affected.",
      "Try again reloads RollKeeper. If that doesn't help, go home.",
    ],
  },
};

/**
 * The 404, route error and global error page. Try again is the one primary
 * action when there is a retry; otherwise Home is.
 */
export default function ErrorPage({ kind, error, onRetry }: ErrorPageProps) {
  const copy = ERROR_PAGE_COPY[kind];
  const canRetry = kind !== 'not-found' && onRetry !== undefined;
  const message = error?.message.trim();

  return (
    <main className="bg-surface text-body flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center">
      <div className="w-full max-w-md">
        <h1 className="type-subheading text-heading">{copy.heading}</h1>
        <p className="type-body text-muted mt-2">{copy.lines[0]}</p>
        <p className="type-body text-muted">{copy.lines[1]}</p>
        {message && (
          <p className="type-small text-muted mt-3 break-words">{message}</p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {canRetry && (
            <Button variant="primary" onClick={() => onRetry?.()}>
              Try again
            </Button>
          )}
          <Button asChild variant={canRetry ? 'secondary' : 'primary'}>
            <a href="/">Home</a>
          </Button>
        </div>
      </div>
    </main>
  );
}
