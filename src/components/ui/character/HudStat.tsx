import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface HudStatProps {
  /** Shown under the value at every width, e.g. "Initiative". */
  caption: string;
  /** The number, e.g. "+2"; or pass `children` instead. */
  value?: string;
  /** Replaces `value` with an ornament that holds the number (`AcShield`). */
  children?: ReactNode;
  /** Makes the tile a button. */
  onClick?: () => void;
}

const TILE =
  'border-divider flex flex-col items-center justify-center rounded-sm border px-3 py-2.5';

/**
 * One HUD stat: the number in `type-num-lg` over its caption, in a hairline
 * tile. With `onClick` the tile is a button whose name is its text
 * ("15 Spell save DC"; the space between the parts keeps the words
 * apart in that name); without it, plain text.
 */
export function HudStat({ caption, value, children, onClick }: HudStatProps) {
  const body = (
    <>
      {children ?? (
        <span className="type-num-lg text-heading whitespace-nowrap">
          {value}
        </span>
      )}{' '}
      <span className="type-caption text-muted whitespace-nowrap">
        {caption}
      </span>
    </>
  );

  if (!onClick) return <div className={TILE}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        TILE,
        'hover:bg-surface-hover focus-visible:outline-ring cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2'
      )}
    >
      {body}
    </button>
  );
}
