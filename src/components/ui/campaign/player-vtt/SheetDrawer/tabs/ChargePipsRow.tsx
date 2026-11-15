import { CLASS_RESOURCE_STYLE } from '@/components/ui/character/classResourceStyles';
import { cn } from '@/utils/cn';

export interface ChargePipsRowProps {
  /** Group label prefix, e.g. "Blink charges" → "Blink charges: 1 of 2". */
  groupLabel: string;
  max: number;
  used: number;
  /** aria-label for a filled (available) pip's spend button. */
  spendLabel: string;
  /** aria-label for an empty (spent) pip's restore button. */
  restoreLabel: string;
  onSpend: () => void;
  onRestore: () => void;
}

export const PIP_BUTTON_CLASS =
  'focus-visible:outline-ring inline-flex min-h-6 min-w-6 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11';

/** Tappable charge pips: filled pips spend a charge, empty pips restore one. */
export function ChargePipsRow({
  groupLabel,
  max,
  used,
  spendLabel,
  restoreLabel,
  onSpend,
  onRestore,
}: ChargePipsRowProps) {
  if (max === 0) return null;
  const remaining = max - used;

  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      <div
        role="group"
        aria-label={`${groupLabel}: ${remaining} of ${max}`}
        className="flex flex-wrap"
      >
        {Array.from({ length: max }, (_, index) => {
          const filled = index < remaining;
          return (
            <button
              key={index}
              type="button"
              aria-label={filled ? spendLabel : restoreLabel}
              onClick={filled ? onSpend : onRestore}
              className={PIP_BUTTON_CLASS}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'size-3 rounded-full border',
                  filled
                    ? CLASS_RESOURCE_STYLE.pipOn
                    : CLASS_RESOURCE_STYLE.pipOff
                )}
              />
            </button>
          );
        })}
      </div>
      <span className="type-small text-muted">
        {remaining} of {max} charges
      </span>
    </div>
  );
}
