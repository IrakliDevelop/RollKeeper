import type { ReactNode } from 'react';

export interface MaybeRollElementProps {
  onRoll?: () => void;
  ariaLabel: string;
  className: string;
  children: ReactNode;
}

/**
 * Renders a rollable button when `onRoll` is provided, otherwise a plain
 * div. Players roll physical dice at the table (`SHEET_DICE_ROLLS_ENABLED`
 * is false), so callers currently pass `onRoll={undefined}` — keep this
 * optional so in-app rolling can be enabled later without touching callers.
 */
export function MaybeRollElement({
  onRoll,
  ariaLabel,
  className,
  children,
}: MaybeRollElementProps) {
  if (onRoll) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onRoll}
        className={className}
      >
        {children}
      </button>
    );
  }
  return <div className={className}>{children}</div>;
}
