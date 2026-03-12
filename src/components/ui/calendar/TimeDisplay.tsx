'use client';

import { useState } from 'react';
import {
  Clock,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Pencil,
  Check,
  X,
} from 'lucide-react';
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
  /** When provided, the time becomes editable. Called with (hour, minute). */
  onTimeEdit?: (hour: number, minute: number) => void;
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
  onTimeEdit,
}: TimeDisplayProps) {
  const weekDayName = config.weekDays[date.dayOfWeek]?.name ?? '';
  const eraStr = getEraDisplay(date.era);

  const [editing, setEditing] = useState(false);
  const [editHour, setEditHour] = useState(date.hour);
  const [editMinute, setEditMinute] = useState(date.minute);

  const maxHour = config.clock.hoursPerDay - 1;
  const maxMinute = config.clock.minutesPerHour - 1;

  const handleStartEdit = () => {
    setEditHour(date.hour);
    setEditMinute(date.minute);
    setEditing(true);
  };

  const handleConfirm = () => {
    onTimeEdit?.(editHour, editMinute);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  const clamp = (val: number, max: number) => Math.max(0, Math.min(max, val));

  return (
    <div className="flex flex-col gap-3">
      {/* Clock */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={editHour}
                onChange={e =>
                  setEditHour(clamp(parseInt(e.target.value) || 0, maxHour))
                }
                min={0}
                max={maxHour}
                autoFocus
                className="text-heading border-divider focus:border-divider-strong w-20 rounded-md border bg-transparent px-3 py-2 text-center font-mono text-3xl font-bold focus:outline-none"
              />
              <span className="text-heading font-mono text-3xl font-bold">
                :
              </span>
              <input
                type="number"
                value={editMinute}
                onChange={e =>
                  setEditMinute(clamp(parseInt(e.target.value) || 0, maxMinute))
                }
                min={0}
                max={maxMinute}
                className="text-heading border-divider focus:border-divider-strong w-20 rounded-md border bg-transparent px-3 py-2 text-center font-mono text-3xl font-bold focus:outline-none"
              />
              <button
                onClick={handleConfirm}
                className="text-accent-emerald-text hover:bg-accent-emerald-bg ml-1 rounded-md p-1.5 transition-colors"
                title="Confirm"
              >
                <Check size={18} />
              </button>
              <button
                onClick={handleCancel}
                className="text-muted hover:bg-surface-hover rounded-md p-1.5 transition-colors"
                title="Cancel"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <>
              <div className="text-heading font-mono text-4xl font-bold tracking-wide">
                {formatTime(date)}
              </div>
              {onTimeEdit && (
                <button
                  onClick={handleStartEdit}
                  className="text-muted hover:text-body hover:bg-surface-hover rounded-md p-1 transition-colors"
                  title="Edit time"
                >
                  <Pencil size={14} />
                </button>
              )}
            </>
          )}
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
