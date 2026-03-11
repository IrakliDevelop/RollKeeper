'use client';

import { Clock, Sun, Moon, Sunrise, Sunset } from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';
import { MoonPhaseIcon } from './MoonPhaseIcon';
import type {
  CalendarDate,
  MoonPhaseInfo,
  CalendarConfig,
  Era,
} from '@/types/calendar';
import { MOON_PHASE_LABELS } from '@/types/calendar';
import { formatDate, formatTime } from '@/utils/calendarCalculations';

interface TimeDisplayProps {
  date: CalendarDate;
  config: CalendarConfig;
  moonPhases: MoonPhaseInfo[];
  dayPeriod: string;
}

function getPeriodIcon(period: string) {
  switch (period) {
    case 'Morning':
      return <Sunrise size={16} className="text-accent-amber-text" />;
    case 'Afternoon':
      return <Sun size={16} className="text-accent-amber-text" />;
    case 'Evening':
      return <Sunset size={16} className="text-accent-orange-text" />;
    case 'Night':
      return <Moon size={16} className="text-accent-blue-text" />;
    default:
      return <Clock size={16} className="text-muted" />;
  }
}

function getEraDisplay(era: Era | undefined): string {
  return era ? ` ${era.abbreviation}` : '';
}

export function TimeDisplay({
  date,
  config,
  moonPhases,
  dayPeriod,
}: TimeDisplayProps) {
  const weekDayName = config.weekDays[date.dayOfWeek]?.name ?? '';
  const eraStr = getEraDisplay(date.era);

  return (
    <div className="flex flex-col gap-3">
      {/* Clock */}
      <div className="flex items-center gap-3">
        <div className="text-heading font-mono text-4xl font-bold tracking-wide">
          {formatTime(date)}
        </div>
        <div className="flex items-center gap-1.5">
          {getPeriodIcon(dayPeriod)}
          <span className="text-body text-sm">{dayPeriod}</span>
        </div>
      </div>

      {/* Date */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-heading text-lg font-semibold">
          {weekDayName && `${weekDayName}, `}
          {formatDate(date, config)}
          {eraStr}
        </span>
        {date.yearName && (
          <Badge variant="info" className="text-xs">
            {date.yearName}
          </Badge>
        )}
      </div>

      {/* Season + Moons */}
      <div className="flex flex-wrap items-center gap-3">
        {date.season && (
          <Badge variant="neutral" className="text-xs">
            {date.season.name}
          </Badge>
        )}
        {moonPhases.map(mp => (
          <div key={mp.moon.name} className="flex items-center gap-1.5">
            <MoonPhaseIcon phase={mp.phase} size="md" />
            <span className="text-muted text-xs">
              {mp.moon.name}: {MOON_PHASE_LABELS[mp.phase]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
