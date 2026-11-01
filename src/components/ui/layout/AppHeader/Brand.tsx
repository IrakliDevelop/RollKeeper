import Link from 'next/link';
import { Button } from '@/components/ui/forms/button';

export function Brand() {
  return (
    <Button asChild variant="ghost" className="shrink-0 gap-2 px-1 sm:px-2">
      <Link href="/" aria-label="RollKeeper home">
        <svg
          viewBox="0 0 100 100"
          className="fill-brass-fill size-6 shrink-0"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M50 8 88.1 30v44L50 96 11.9 74V30Z M50 33a11 11 0 0 0-4.6 20.99L41.5 73h17l-3.9-19.01A11 11 0 0 0 50 33Z"
          />
        </svg>
        <span className="type-subheading hidden sm:inline" aria-hidden="true">
          RollKeeper
        </span>
      </Link>
    </Button>
  );
}
