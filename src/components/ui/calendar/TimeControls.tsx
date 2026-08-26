'use client';

import {
  RotateCcw,
  Timer,
  Clock,
  Sun,
  Moon as MoonIcon,
  CalendarDays,
  CalendarRange,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import type { CalendarConfig } from '@/types/calendar';
import {
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

  return (
    <div className="space-y-3">
      {/* Rewind / Advance row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted mr-1 text-xs font-medium tracking-wider uppercase">
          Rewind
        </span>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<CalendarDays size={14} />}
          onClick={() => onAdvance(-dayMs)}
        >
          −Day
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Clock size={14} />}
          onClick={() => onAdvance(-hourMs)}
        >
          −Hour
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Timer size={14} />}
          onClick={() => onAdvance(-minuteMs)}
        >
          −Min
        </Button>

        <div className="border-divider mx-1.5 hidden h-6 border-l sm:block" />

        <span className="text-muted mr-1 text-xs font-medium tracking-wider uppercase">
          Advance
        </span>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<RotateCcw size={14} />}
          onClick={() => onAdvance(roundMs)}
        >
          +Round
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Timer size={14} />}
          onClick={() => onAdvance(minuteMs)}
        >
          +Min
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Clock size={14} />}
          onClick={() => onAdvance(hourMs)}
        >
          +Hour
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<CalendarDays size={14} />}
          onClick={() => onAdvance(dayMs)}
        >
          +Day
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<CalendarRange size={14} />}
          onClick={() => onAdvance(weekMs)}
        >
          +Week
        </Button>
      </div>

      {/* Rests row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted mr-1 text-xs font-medium tracking-wider uppercase">
          Rests
        </span>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Sun size={14} />}
          onClick={() => onAdvance(shortRestMs)}
        >
          Short Rest
        </Button>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<MoonIcon size={14} />}
          onClick={() => onAdvance(longRestMs)}
        >
          Long Rest
        </Button>
      </div>
    </div>
  );
}
