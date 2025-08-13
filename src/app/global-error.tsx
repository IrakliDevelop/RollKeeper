'use client';

import ErrorPage from '@/components/ui/ErrorPage';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html>
      <body>
        <ErrorPage
          error={error}
          reset={reset}
          title="Reality.exe Has Stopped Working!"
          description={error.message}
        />
      </body>
    </html>
  );
}