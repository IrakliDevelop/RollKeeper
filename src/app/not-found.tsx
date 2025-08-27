import ErrorPage from '@/components/ui/feedback/ErrorPage';

export default function NotFound() {
  return (
    <ErrorPage
      title="Page Not Found!"
      description="The page you're looking for seems to have been banished to another dimension."
      showRetry={false}
    />
  );
}