import { Button } from '@/components/ui/forms/button';
import { AppIcon } from '@/components/ui/icons';

export interface QuickCombatStripProps {
  hasUsedReaction: boolean;
  onToggleReaction: () => void;
  count: number;
  maxCount: number;
  stackable: boolean;
  onUse: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}

/**
 * One-row action-economy strip below the AC/Init grid: reaction toggle chip
 * (left) + heroic inspiration chip with award/correct stepper (right).
 * Replaces the old full-height `HeroicInspirationRow`.
 */
export function QuickCombatStrip({
  hasUsedReaction,
  onToggleReaction,
  count,
  maxCount,
  stackable,
  onUse,
  onIncrement,
  onDecrement,
}: QuickCombatStripProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={onToggleReaction}
        aria-pressed={hasUsedReaction}
        aria-label={
          hasUsedReaction ? 'Reaction used — tap to reset' : 'Use reaction'
        }
        className={`min-h-[44px] rounded-lg border px-2 text-xs font-bold tracking-wider uppercase ${
          hasUsedReaction
            ? 'border-divider text-faint'
            : 'bg-accent-emerald-bg text-accent-emerald-text border-accent-emerald-border'
        }`}
      >
        <span className="flex items-center justify-center gap-1">
          <AppIcon name="reaction" className="h-4 w-4" />
          {hasUsedReaction ? 'Used' : 'Reaction'}
        </span>
      </button>

      <div className="flex items-center gap-1">
        <button
          onClick={onUse}
          disabled={count === 0}
          aria-label="Use heroic inspiration"
          className={`min-h-[44px] flex-1 rounded-lg border px-2 text-xs font-bold tracking-wider uppercase ${
            count > 0
              ? 'bg-accent-amber-bg text-accent-amber-text border-accent-amber-border'
              : 'border-divider text-faint'
          }`}
        >
          <span className="flex items-center justify-center gap-1">
            <AppIcon name="inspiration" className="h-4 w-4" />
            {stackable ? `×${count}` : ''}
          </span>
        </button>
        {count > 0 && (
          <Button
            variant="outline"
            size="lg"
            onClick={onDecrement}
            aria-label="Remove heroic inspiration"
          >
            −
          </Button>
        )}
        {count < maxCount && (
          <Button
            variant="outline"
            size="lg"
            onClick={onIncrement}
            aria-label="Add heroic inspiration"
          >
            +
          </Button>
        )}
      </div>
    </div>
  );
}
