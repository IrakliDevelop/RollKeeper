'use client';

import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import type { CalendarConfig } from '@/types/calendar';

interface CalendarNavProps {
  browseYear: number;
  browseMonth: number;
  config: CalendarConfig;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  isBrowsing: boolean;
}

export function CalendarNav({
  browseYear,
  browseMonth,
  config,
  onPrevMonth,
  onNextMonth,
  onToday,
  isBrowsing,
}: CalendarNavProps) {
  const monthName =
    config.months[browseMonth]?.name ?? `Month ${browseMonth + 1}`;
  const era = config.eras.find(
    e =>
      browseYear >= e.startYear &&
      (e.endYear === undefined || browseYear <= e.endYear)
  );

  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="sm" onClick={onPrevMonth}>
        <ChevronLeft size={18} />
      </Button>

      <div className="flex items-center gap-2">
        <h3 className="text-heading text-lg font-semibold">
          {monthName} {browseYear}
          {era ? ` ${era.abbreviation}` : ''}
        </h3>
        {isBrowsing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToday}
            leftIcon={<Home size={14} />}
          >
            Today
          </Button>
        )}
      </div>

      <Button variant="ghost" size="sm" onClick={onNextMonth}>
        <ChevronRight size={18} />
      </Button>
    </div>
  );
}
