import { useEffect, useId, useRef } from 'react';
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
  const pendingMove = useRef<'up' | 'down' | null>(null);
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const direction = pendingMove.current;
    if (!direction) return;
    pendingMove.current = null;
    const preferred = direction === 'up' ? upRef.current : downRef.current;
    const fallback = direction === 'up' ? downRef.current : upRef.current;
    (preferred && !preferred.disabled ? preferred : fallback)?.focus();
  }, [index, count]);
  return (
    <div className="flex flex-wrap gap-1 pb-2 pl-3">
      <span id={descriptionId} className="sr-only">
        {name}
      </span>
      <Button
        ref={upRef}
        type="button"
        variant="ghost"
        size="xs"
        aria-describedby={descriptionId}
        disabled={index === 0}
        className="pointer-coarse:min-h-11"
        onClick={() => {
          pendingMove.current = 'up';
          onMove(index - 1);
        }}
      >
        Move up
      </Button>
      <Button
        ref={downRef}
        type="button"
        variant="ghost"
        size="xs"
        aria-describedby={descriptionId}
        disabled={index === count - 1}
        className="pointer-coarse:min-h-11"
        onClick={() => {
          pendingMove.current = 'down';
          onMove(index + 1);
        }}
      >
        Move down
      </Button>
    </div>
  );
}
