import { useId } from 'react';
import { Button } from '@/components/ui/forms/button';

export function EquipmentReorderControls({
  name,
  index,
  count,
  onMove,
}: {
  name: string;
  index: number;
  count: number;
  onMove: (destinationIndex: number) => void;
}) {
  const descriptionId = useId();
  return (
    <div className="flex flex-wrap gap-1 pb-2 pl-3">
      <span id={descriptionId} className="sr-only">
        {name}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        aria-describedby={descriptionId}
        disabled={index === 0}
        className="pointer-coarse:min-h-11"
        onClick={() => onMove(index - 1)}
      >
        Move up
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        aria-describedby={descriptionId}
        disabled={index === count - 1}
        className="pointer-coarse:min-h-11"
        onClick={() => onMove(index + 1)}
      >
        Move down
      </Button>
    </div>
  );
}
