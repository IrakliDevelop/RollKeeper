'use client';

import { cn } from '@/utils/cn';
import { MAX_PIPS, SlotPips, slotPipsLabel, type SlotLevel } from './SlotPips';

export interface SlotPipsButtonsProps {
  total: number;
  available: number;
  level: SlotLevel;
  onSpend?: () => void;
  onRestore?: () => void;
  className?: string;
}

/** A one-step interactive sibling of the display-only SlotPips. */
export function SlotPipsButtons({
  total,
  available,
  level,
  onSpend,
  onRestore,
  className,
}: SlotPipsButtonsProps) {
  const max = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  if (max === 0) return null;
  const left = Number.isFinite(available)
    ? Math.min(max, Math.max(0, Math.floor(available)))
    : 0;
  if (!onSpend || !onRestore) {
    return (
      <SlotPips
        total={max}
        available={left}
        level={level}
        className={className}
      />
    );
  }

  return (
    <span
      role="group"
      aria-label={slotPipsLabel(left, max, level)}
      className={cn('inline-flex flex-wrap items-center', className)}
    >
      {Array.from({ length: Math.min(max, MAX_PIPS) }, (_, position) => {
        const isAvailable = position < left;
        const kind = level === 'pact' ? 'pact' : `level ${level}`;
        return (
          <button
            key={position}
            type="button"
            data-state={isAvailable ? 'available' : 'spent'}
            aria-label={`${isAvailable ? 'Spend' : 'Restore'} a ${kind} slot`}
            onClick={isAvailable ? () => onSpend() : () => onRestore()}
            className="focus-visible:outline-ring flex min-h-6 min-w-6 cursor-pointer items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          >
            <span
              aria-hidden="true"
              className={cn(
                'border-lapis-border size-2.5 rounded-full border-[1.5px]',
                isAvailable && 'bg-lapis-fill'
              )}
            />
          </button>
        );
      })}
    </span>
  );
}
