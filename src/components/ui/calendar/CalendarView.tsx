'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Settings, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/layout/card';
import { Button } from '@/components/ui/forms/button';
import { TimeDisplay } from './TimeDisplay';
import { TimeControls } from './TimeControls';
import { CalendarNav } from './CalendarNav';
import { CalendarGrid } from './CalendarGrid';
import { MoonLegend } from './MoonLegend';
import { useCalendar } from '@/hooks/useCalendar';
import { useCalendarStore } from '@/store/calendarStore';
interface CalendarViewProps {
  campaignCode: string;
  onReset?: () => void;
}

export function CalendarView({ campaignCode, onReset }: CalendarViewProps) {
  const calendar = useCalendarStore(state =>
    state.calendars.find(c => c.campaignCode === campaignCode)
  );
  const advanceTime = useCalendarStore(state => state.advanceTime);
  const { date, moonPhases, dayPeriod } = useCalendar(campaignCode);

  // Browse mode — tracks which month/year the grid is showing
  const [browseYear, setBrowseYear] = useState<number | null>(null);
  const [browseMonth, setBrowseMonth] = useState<number | null>(null);

  if (!calendar || !date) return null;

  const config = calendar.config;
  const displayYear = browseYear ?? date.year;
  const displayMonth = browseMonth ?? date.month;
  const isBrowsing = browseYear !== null || browseMonth !== null;

  const handlePrevMonth = () => {
    const y = browseYear ?? date.year;
    const m = browseMonth ?? date.month;
    if (m === 0) {
      setBrowseYear(y - 1);
      setBrowseMonth(config.months.length - 1);
    } else {
      setBrowseYear(y);
      setBrowseMonth(m - 1);
    }
  };

  const handleNextMonth = () => {
    const y = browseYear ?? date.year;
    const m = browseMonth ?? date.month;
    if (m === config.months.length - 1) {
      setBrowseYear(y + 1);
      setBrowseMonth(0);
    } else {
      setBrowseYear(y);
      setBrowseMonth(m + 1);
    }
  };

  const handleToday = () => {
    setBrowseYear(null);
    setBrowseMonth(null);
  };

  const handleAdvance = (deltaMs: number) => {
    advanceTime(campaignCode, deltaMs);
    // Reset browse mode so the grid follows the current date
    setBrowseYear(null);
    setBrowseMonth(null);
  };

  return (
    <div className="space-y-6">
      {/* Time display + controls */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start justify-between">
            <TimeDisplay
              date={date}
              config={config}
              moonPhases={moonPhases}
              dayPeriod={dayPeriod}
            />
            <div className="flex items-center gap-2">
              <Link href={`/dm/campaign/${campaignCode}/calendar/settings`}>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Settings size={16} />}
                >
                  Settings
                </Button>
              </Link>
              {onReset && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<RotateCcw size={16} />}
                  onClick={onReset}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
          <div className="border-divider border-t pt-4">
            <TimeControls
              currentTime={calendar.currentTime}
              config={config}
              onAdvance={handleAdvance}
            />
          </div>
        </CardContent>
      </Card>

      {/* Calendar grid */}
      <Card>
        <CardContent className="p-4">
          <CalendarNav
            browseYear={displayYear}
            browseMonth={displayMonth}
            config={config}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onToday={handleToday}
            isBrowsing={isBrowsing}
          />
          <div className="mt-4">
            <CalendarGrid
              browseYear={displayYear}
              browseMonth={displayMonth}
              config={config}
              currentDate={date}
            />
          </div>
          {config.moons.length > 0 && (
            <div className="border-divider mt-4 border-t pt-4">
              <MoonLegend config={config} currentMoonPhases={moonPhases} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
