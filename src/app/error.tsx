'use client';

import ErrorPage from '@/components/ui/feedback/ErrorPage';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      title="Page Spell Backfired!"
      description={error.message}
    />
  );
}
