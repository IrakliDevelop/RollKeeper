'use client';

import ErrorPage from '@/components/ui/feedback/ErrorPage';

interface ErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export default function Error({ error, retry }: ErrorProps) {
  return <ErrorPage kind="route" error={error} onRetry={retry} />;
}
