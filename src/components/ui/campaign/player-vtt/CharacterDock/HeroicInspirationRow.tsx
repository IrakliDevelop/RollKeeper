import { Button } from '@/components/ui/forms/button';

export interface HeroicInspirationRowProps {
  count: number;
  maxCount?: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onUse: () => void;
}

/** Heroic inspiration counter + spend control, shown at the bottom of `DockVitals`. */
export function HeroicInspirationRow({
  count,
  maxCount,
  onIncrement,
  onDecrement,
  onUse,
}: HeroicInspirationRowProps) {
  return (
    <div className="border-divider flex items-center justify-between rounded-lg border p-3">
      <span className="text-heading font-semibold">✦ Heroic ×{count}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="lg"
          onClick={onDecrement}
          aria-label="Remove heroic inspiration"
        >
          −
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={onIncrement}
          disabled={maxCount != null && count >= maxCount}
          aria-label="Add heroic inspiration"
        >
          +
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={onUse}
          disabled={count === 0}
        >
          Use
        </Button>
      </div>
    </div>
  );
}
