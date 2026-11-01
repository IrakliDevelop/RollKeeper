import { cn } from '@/utils/cn';

/** A spell slot level (1–9), or the warlock's pact slots. */
export type SlotLevel = number | 'pact';

/**
 * The most pips drawn in one row. No class reaches it (a level has at most
 * 4 slots); it keeps a corrupted count from drawing thousands. The label
 * still says the real numbers.
 */
export const MAX_PIPS = 20;

/** Whole, non-negative and finite; anything else counts as 0. */
function count(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/** "2 of 4 level 1 slots available", "2 of 2 pact slots available". */
export function slotPipsLabel(
  available: number,
  total: number,
  level: SlotLevel
): string {
  const kind = level === 'pact' ? 'pact' : `level ${level}`;
  return `${available} of ${total} ${kind} slots available`;
}

export interface SlotPipsProps {
  /** Slots at this level. Nothing renders when there are none. */
  total: number;
  /** Slots not yet spent; clamped to 0…total. */
  available: number;
  level: SlotLevel;
  className?: string;
}

/**
 * Spell slots as 10px lapis pips: filled while available, hollow once
 * spent, available ones first. Display only; screen readers hear one label
 * for the whole row.
 */
export function SlotPips({
  total,
  available,
  level,
  className,
}: SlotPipsProps) {
  const max = count(total);
  if (max === 0) return null;
  const left = Math.min(count(available), max);
  const drawn = Math.min(max, MAX_PIPS);

  return (
    <span
      role="img"
      aria-label={slotPipsLabel(left, max, level)}
      className={cn('inline-flex flex-wrap items-center gap-1', className)}
    >
      {/* Pips are positions, not items: the index is their identity. */}
      {Array.from({ length: drawn }, (_, position) => (
        <span
          key={position}
          data-state={position < left ? 'available' : 'spent'}
          className={cn(
            'border-lapis-border size-2.5 shrink-0 rounded-full border-[1.5px]',
            position < left && 'bg-lapis-fill'
          )}
        />
      ))}
    </span>
  );
}
