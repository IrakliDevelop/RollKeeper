'use client';

import { useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';

/** A tally stepper: label, minus, value, plus. */
export function CounterStepper({
  label,
  value,
  name,
  onAdjust,
}: {
  label: string;
  value: number;
  name: string;
  onAdjust: (delta: number) => void;
}) {
  const labelId = useId();
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex items-center gap-1"
    >
      <span id={labelId} className="type-small text-muted mr-1">
        {label}
      </span>
      <Button
        variant="ghost"
        size="xs"
        className="px-1.5"
        aria-label={`Remove 1 ${label} from ${name}`}
        disabled={value <= 0}
        onClick={() => onAdjust(-1)}
      >
        <Minus size={14} aria-hidden="true" />
      </Button>
      <span className="type-ui text-heading min-w-5 text-center tabular-nums">
        {value}
      </span>
      <Button
        variant="ghost"
        size="xs"
        className="px-1.5"
        aria-label={`Add 1 ${label} to ${name}`}
        onClick={() => onAdjust(1)}
      >
        <Plus size={14} aria-hidden="true" />
      </Button>
    </div>
  );
}
