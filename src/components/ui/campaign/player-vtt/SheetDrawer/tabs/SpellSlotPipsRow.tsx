import { cn } from '@/utils/cn';

export interface SpellSlotPipsRowProps {
  /** Optional leading label, e.g. "Pact slots (1st level)". */
  heading?: string;
  max: number;
  used: number;
  /** aria-label for a filled (available) pip's spend button. */
  spendLabel: string;
  /** aria-label for an empty (spent) pip's restore button. */
  restoreLabel: string;
  onSpend: () => void;
  onRestore: () => void;
}

/** Tappable slot pips row: filled pips spend a slot, empty pips restore one. */
export function SpellSlotPipsRow({
  heading,
  max,
  used,
  spendLabel,
  restoreLabel,
  onSpend,
  onRestore,
}: SpellSlotPipsRowProps) {
  if (max === 0) return null;
  const remaining = max - used;

  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      {heading && (
        <span className="text-muted text-xs font-semibold">{heading}</span>
      )}
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, index) => {
          const filled = index < remaining;
          return (
            <button
              key={index}
              type="button"
              aria-label={filled ? spendLabel : restoreLabel}
              onClick={filled ? onSpend : onRestore}
              className={cn(
                'h-3 w-3 rounded-full border',
                filled
                  ? 'bg-accent-purple-text-muted border-accent-purple-border'
                  : 'border-divider'
              )}
            />
          );
        })}
      </div>
      <span className="text-faint text-xs">
        {remaining} of {max} slots
      </span>
    </div>
  );
}
