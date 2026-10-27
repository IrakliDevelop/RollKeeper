import { X } from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';
import { cn } from '@/utils/cn';

/** Ember for a condition, lapis for concentration. */
export type ConditionChipKind = 'condition' | 'concentration';

export interface ConditionChipProps {
  /** Always shown in full, e.g. "Poisoned" or "Concentrating on Bless". */
  name: string;
  kind?: ConditionChipKind;
  /** Shown as "x2" from 2 up, e.g. levels of exhaustion. */
  stackCount?: number;
  /** Adds a remove button. */
  onRemove?: () => void;
  /** The remove button's label; "Remove {name}", or "End concentration". */
  removeLabel?: string;
  className?: string;
}

/**
 * A condition on a creature: an ember `Badge` with the condition's name, or
 * lapis for concentration. The name is never cut short, and nothing about
 * the condition is hover-only.
 */
export function ConditionChip({
  name,
  kind = 'condition',
  stackCount,
  onRemove,
  removeLabel,
  className,
}: ConditionChipProps) {
  const stacks = Math.floor(stackCount ?? 0);
  const label =
    removeLabel ??
    (kind === 'concentration' ? 'End concentration' : `Remove ${name}`);

  return (
    <Badge
      variant={kind === 'concentration' ? 'magic' : 'warning'}
      size="sm"
      data-kind={kind}
      className={cn('max-w-full', className)}
    >
      <span className="min-w-0 break-words">{name}</span>
      {stacks > 1 && <span className="shrink-0 tabular-nums">x{stacks}</span>}
      {onRemove && (
        <button
          type="button"
          aria-label={label}
          onClick={event => {
            // Chips sit inside clickable rows; removing must not open them.
            event.stopPropagation();
            onRemove();
          }}
          // -mr-1 pulls the X into the chip's padding so it sits optically
          // centred; the hit area is the ::after below, not the margin.
          className={cn(
            'relative -mr-1 inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm',
            'hover:bg-surface-hover focus-visible:outline-ring focus-visible:outline-2',
            'after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-1/2 pointer-coarse:after:size-11'
          )}
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      )}
    </Badge>
  );
}
