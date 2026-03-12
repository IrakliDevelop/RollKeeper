'use client';

import {
  RotateCcw,
  Timer,
  Clock,
  Sun,
  Moon as MoonIcon,
  CalendarDays,
  CalendarRange,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import type { CalendarConfig } from '@/types/calendar';
import {
  addTime,
  getShortRestMs,
  getLongRestMs,
  getMsPerDay,
} from '@/utils/calendarCalculations';

interface TimeControlsProps {
  currentTime: number;
  config: CalendarConfig;
  onAdvance: (deltaMs: number) => void;
}

export function TimeControls({
  currentTime,
  config,
  onAdvance,
}: TimeControlsProps) {
  const roundMs = config.mechanics.secondsPerRound * 1000;
  const minuteMs = config.clock.secondsPerMinute * 1000;
  const hourMs =
    config.clock.minutesPerHour * config.clock.secondsPerMinute * 1000;
  const shortRestMs = getShortRestMs(config);
  const longRestMs = getLongRestMs(config);
  const dayMs = getMsPerDay(config);
  const weekMs = dayMs * config.weekDays.length;

  const buttons = [
    {
      label: '+Round',
      icon: <RotateCcw size={14} />,
      delta: roundMs,
      variant: 'ghost' as const,
    },
    {
      label: '+Min',
      icon: <Timer size={14} />,
      delta: minuteMs,
      variant: 'ghost' as const,
    },
    {
      label: '+Hour',
      icon: <Clock size={14} />,
      delta: hourMs,
      variant: 'ghost' as const,
    },
    {
      label: 'Short Rest',
      icon: <Sun size={14} />,
      delta: shortRestMs,
      variant: 'outline' as const,
    },
    {
      label: 'Long Rest',
      icon: <MoonIcon size={14} />,
      delta: longRestMs,
      variant: 'outline' as const,
    },
    {
      label: '+Day',
      icon: <CalendarDays size={14} />,
      delta: dayMs,
      variant: 'ghost' as const,
    },
    {
      label: '+Week',
      icon: <CalendarRange size={14} />,
      delta: weekMs,
      variant: 'ghost' as const,
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<Undo2 size={14} />}
        onClick={() => onAdvance(-dayMs)}
        title="Go back one day"
      >
        -Day
      </Button>
      {buttons.map(btn => (
        <Button
          key={btn.label}
          variant={btn.variant}
          size="sm"
          leftIcon={btn.icon}
          onClick={() => onAdvance(btn.delta)}
        >
          {btn.label}
        </Button>
      ))}
    </div>
  );
}
