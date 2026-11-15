import { Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { AppIcon } from '@/components/ui/icons';
import { Tooltip } from '@/components/ui/primitives/Tooltip';
import { cn } from '@/utils/cn';

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
 * One-row action-economy strip below the AC/Init readouts: reaction toggle
 * (left) + heroic inspiration button with award/correct steppers (right).
 * Same recipe as the sheet HUD. Its three Tooltips need the
 * `TooltipProvider` that `PlayerVttScreen` wraps around the floating panels.
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
      <Button
        variant="secondary"
        size="sm"
        aria-pressed={hasUsedReaction}
        aria-label="Reaction used"
        leftIcon={<AppIcon name="reaction" className="size-4" />}
        onClick={onToggleReaction}
        className={cn(
          'w-full',
          hasUsedReaction && 'border-input-border bg-surface-inset text-heading'
        )}
      >
        Reaction
      </Button>

      <div className="flex items-center gap-1">
        <Tooltip content="Use heroic inspiration">
          <Button
            variant="secondary"
            size="sm"
            selected={count > 0}
            disabled={count === 0}
            aria-label="Use heroic inspiration"
            leftIcon={<AppIcon name="inspiration" className="size-4" />}
            onClick={onUse}
            className="min-w-0 flex-1 gap-1 px-2"
          >
            {stackable ? `×${count}` : null}
          </Button>
        </Tooltip>
        {count > 0 && (
          <Tooltip content="Remove heroic inspiration">
            <Button
              variant="ghost"
              size="sm"
              className="w-9 shrink-0 px-0"
              aria-label="Remove heroic inspiration"
              onClick={onDecrement}
            >
              <Minus size={16} aria-hidden />
            </Button>
          </Tooltip>
        )}
        {count < maxCount && (
          <Tooltip content="Add heroic inspiration">
            <Button
              variant="ghost"
              size="sm"
              className="w-9 shrink-0 px-0"
              aria-label="Add heroic inspiration"
              onClick={onIncrement}
            >
              <Plus size={16} aria-hidden />
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
