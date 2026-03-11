'use client';

import { cn } from '@/utils/cn';
import { MoonPhaseIcon } from './MoonPhaseIcon';
import type {
  CalendarConfig,
  CalendarDate,
  MoonPhaseInfo,
} from '@/types/calendar';
import {
  getMonthGrid,
  getAllMoonPhases,
  getTotalDaysForDate,
} from '@/utils/calendarCalculations';

interface CalendarGridProps {
  browseYear: number;
  browseMonth: number;
  config: CalendarConfig;
  currentDate: CalendarDate;
}

/**
 * Returns moon phases that changed on this day compared to the previous day.
 * This way we only show the emoji on the first day of each phase.
 */
function getPhaseTransitions(
  totalDays: number,
  config: CalendarConfig
): MoonPhaseInfo[] {
  const today = getAllMoonPhases(totalDays, config);
  const yesterday = getAllMoonPhases(totalDays - 1, config);

  return today.filter((mp, i) => mp.phaseIndex !== yesterday[i]?.phaseIndex);
}

export function CalendarGrid({
  browseYear,
  browseMonth,
  config,
  currentDate,
}: CalendarGridProps) {
  const grid = getMonthGrid(browseYear, browseMonth, config);
  const isCurrentMonth =
    currentDate.year === browseYear && currentDate.month === browseMonth;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {config.weekDays.map(wd => (
              <th
                key={wd.name}
                className="text-muted border-divider border-b px-1 py-2 text-center text-xs font-medium"
              >
                {wd.name.slice(0, 3)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) => {
                if (day === null) {
                  return (
                    <td
                      key={`empty-${di}`}
                      className="border-divider border-b p-1"
                    />
                  );
                }

                const isToday =
                  isCurrentMonth && day === currentDate.dayOfMonth;
                const totalDays = getTotalDaysForDate(
                  browseYear,
                  browseMonth,
                  day,
                  config
                );
                const transitions = getPhaseTransitions(totalDays, config);

                return (
                  <td
                    key={day}
                    className={cn(
                      'border-divider border-b p-1 text-center align-top',
                      isToday && 'bg-accent-blue-bg'
                    )}
                  >
                    <div
                      className={cn(
                        'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm',
                        isToday
                          ? 'bg-accent-blue-bg text-accent-blue-text ring-accent-blue-border font-bold ring-2'
                          : 'text-body'
                      )}
                    >
                      {day + 1}
                    </div>
                    {transitions.length > 0 && (
                      <div className="mt-0.5 flex justify-center gap-0.5">
                        {transitions.map(mp => (
                          <MoonPhaseIcon
                            key={mp.moon.name}
                            phase={mp.phase}
                            size="sm"
                            moonName={mp.moon.name}
                          />
                        ))}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
