'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { MoonPhaseIcon } from './MoonPhaseIcon';
import { PeriodIcon } from './PeriodIcon';
import { TimeEditDialog } from './TimeEditDialog';
import type {
  CalendarDate,
  MoonPhaseInfo,
  CalendarConfig,
  Era,
  WeatherType,
} from '@/types/calendar';
import { MOON_PHASE_LABELS, WEATHER_OPTIONS } from '@/types/calendar';
import { AppIcon, WEATHER_ICONS, getIconName } from '@/components/ui/icons';
import { formatDate, formatTime } from '@/utils/calendarCalculations';

interface TimeDisplayProps {
  date: CalendarDate;
  config: CalendarConfig;
  moonPhases: MoonPhaseInfo[];
  dayPeriod: string;
  weather?: WeatherType;
  /** When provided, the time becomes editable. Called with (hour, minute). */
  onTimeEdit?: (hour: number, minute: number) => void;
}

function getEraDisplay(era: Era | undefined): string {
  return era ? ` ${era.abbreviation}` : '';
}

export function TimeDisplay({
  date,
  config,
  moonPhases,
  dayPeriod,
  weather,
  onTimeEdit,
}: TimeDisplayProps) {
  const weatherInfo = weather
    ? WEATHER_OPTIONS.find(w => w.type === weather)
    : null;
  const weekDayName = config.weekDays[date.dayOfWeek]?.name ?? '';
  const eraStr = getEraDisplay(date.era);

  const [timeDialogOpen, setTimeDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {/* Clock */}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="type-num-lg text-heading tabular-nums">
            {formatTime(date)}
          </span>
          {onTimeEdit && (
            <>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Pencil size={14} aria-hidden />}
                onClick={() => setTimeDialogOpen(true)}
              >
                Edit time
              </Button>
              <TimeEditDialog
                open={timeDialogOpen}
                onClose={() => setTimeDialogOpen(false)}
                date={date}
                config={config}
                onSave={onTimeEdit}
              />
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <PeriodIcon period={dayPeriod} />
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
          <Badge variant="neutral" className="text-xs">
            {date.yearName}
          </Badge>
        )}
      </div>

      {/* Season + Weather + Moons */}
      <div className="flex flex-wrap items-center gap-3">
        {date.season && (
          <Badge variant="neutral" className="text-xs">
            {date.season.name}
          </Badge>
        )}
        {weatherInfo && (
          <Badge variant="neutral" className="text-xs">
            <AppIcon
              name={getIconName(
                WEATHER_ICONS,
                weatherInfo.type,
                'weatherClear'
              )}
              className="h-3.5 w-3.5"
            />{' '}
            {weatherInfo.label}
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
