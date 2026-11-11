'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/forms/button';
import type { CalendarConfig } from '@/types/calendar';
import {
  getShortRestMs,
  getLongRestMs,
  getMsPerDay,
} from '@/utils/calendarCalculations';

interface TimeControlsProps {
  config: CalendarConfig;
  onAdvance: (deltaMs: number) => void;
}

function StepGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={id}
      className="flex flex-wrap items-center gap-2"
    >
      <span id={id} className="type-label-heading text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

export function TimeControls({ config, onAdvance }: TimeControlsProps) {
  const roundMs = config.mechanics.secondsPerRound * 1000;
  const minuteMs = config.clock.secondsPerMinute * 1000;
  const hourMs =
    config.clock.minutesPerHour * config.clock.secondsPerMinute * 1000;
  const shortRestMs = getShortRestMs(config);
  const longRestMs = getLongRestMs(config);
  const dayMs = getMsPerDay(config);
  const weekMs = dayMs * config.weekDays.length;

  const steps = (
    items: { text: string; label: string; ms: number }[]
  ): React.ReactNode =>
    items.map(item => (
      <Button
        key={item.label}
        variant="ghost"
        size="sm"
        aria-label={item.label}
        onClick={() => onAdvance(item.ms)}
      >
        {item.text}
      </Button>
    ));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <StepGroup label="Rewind">
          {steps([
            { text: '−1 day', label: 'Rewind 1 day', ms: -dayMs },
            { text: '−1 hour', label: 'Rewind 1 hour', ms: -hourMs },
            { text: '−1 min', label: 'Rewind 1 minute', ms: -minuteMs },
          ])}
        </StepGroup>
        <StepGroup label="Advance">
          {steps([
            { text: '+1 round', label: 'Advance 1 round', ms: roundMs },
            { text: '+1 min', label: 'Advance 1 minute', ms: minuteMs },
            { text: '+1 hour', label: 'Advance 1 hour', ms: hourMs },
            { text: '+1 day', label: 'Advance 1 day', ms: dayMs },
            { text: '+1 week', label: 'Advance 1 week', ms: weekMs },
          ])}
        </StepGroup>
      </div>

      <StepGroup label="Rests">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAdvance(shortRestMs)}
        >
          Short rest
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAdvance(longRestMs)}
        >
          Long rest
        </Button>
      </StepGroup>
    </div>
  );
}
