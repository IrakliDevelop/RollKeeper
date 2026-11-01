import { cn } from '@/utils/cn';

export interface AcShieldProps {
  /** The armor class to show. */
  value: number;
  className?: string;
}

/**
 * Armor class inside a brass shield outline: the only icon-shaped container
 * in the design system. It shows the number only; the caller supplies the
 * "AC" caption or label, and wraps it in a button when it does something.
 */
export function AcShield({ value, className }: AcShieldProps) {
  return (
    <span
      data-ac-shield=""
      className={cn(
        'relative inline-grid h-13 w-12 shrink-0 place-items-center',
        className
      )}
    >
      <svg
        viewBox="0 0 48 52"
        aria-hidden="true"
        focusable="false"
        className="stroke-brass-border pointer-events-none absolute inset-0 size-full fill-none"
      >
        <path
          d="M24 2.5 L44 9 V25 C44 37.5 35.5 45.5 24 49.5 C12.5 45.5 4 37.5 4 25 V9 Z"
          strokeWidth="1.75"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="type-num-lg text-heading relative -mt-1">{value}</span>
    </span>
  );
}
