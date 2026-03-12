'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/forms/button';
import { MoonPhaseIcon } from './MoonPhaseIcon';
import type {
  CalendarConfig,
  CalendarDate,
  CalendarEvent,
  MoonPhaseInfo,
} from '@/types/calendar';
import {
  getMonthGrid,
  getAllMoonPhases,
  getTotalDaysForDate,
} from '@/utils/calendarCalculations';

export interface SelectedDay {
  year: number;
  month: number;
  day: number;
}

interface CalendarGridProps {
  browseYear: number;
  browseMonth: number;
  config: CalendarConfig;
  currentDate: CalendarDate;
  events?: CalendarEvent[];
  selectedDay?: SelectedDay | null;
  onDayClick?: (year: number, month: number, day: number) => void;
  onAddEvent?: () => void;
  onEditEvent?: (event: CalendarEvent) => void;
  onDeleteEvent?: (eventId: string) => void;
  showMoonPhases?: boolean;
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

function DayPopover({
  selectedDay,
  events,
  config,
  anchorRect,
  containerRect,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onClose,
}: {
  selectedDay: SelectedDay;
  events: CalendarEvent[];
  config: CalendarConfig;
  anchorRect: DOMRect;
  containerRect: DOMRect;
  onAddEvent: () => void;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (eventId: string) => void;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const monthName =
    config.months[selectedDay.month]?.name ?? `Month ${selectedDay.month + 1}`;

  // Position: centered below the cell, clamped within container
  const popoverWidth = 220;
  const cellCenterX =
    anchorRect.left - containerRect.left + anchorRect.width / 2;
  let left = cellCenterX - popoverWidth / 2;
  // Clamp to container bounds
  left = Math.max(0, Math.min(left, containerRect.width - popoverWidth));
  const top = anchorRect.bottom - containerRect.top + 4;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    // Delay to avoid the same click that opened it
    const timer = setTimeout(
      () => document.addEventListener('mousedown', handleClickOutside),
      0
    );
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="bg-surface-raised border-divider absolute z-20 origin-top animate-[popover-in_150ms_ease-out] rounded-lg border shadow-lg"
      style={{ top, left, width: popoverWidth }}
    >
      <div className="border-divider flex items-center justify-between border-b px-3 py-2">
        <span className="text-heading text-xs font-semibold">
          {selectedDay.day + 1} {monthName}
        </span>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus size={12} />}
          onClick={onAddEvent}
          className="!h-6 !px-1.5 !text-xs"
        >
          Add
        </Button>
      </div>
      <div className="max-h-32 overflow-y-auto">
        {events.length === 0 ? (
          <p className="text-muted px-3 py-2 text-xs">No events</p>
        ) : (
          <div className="p-1.5">
            {events.map(event => (
              <div
                key={event.id}
                className="hover:bg-surface-secondary group flex items-center gap-1.5 rounded px-2 py-1.5 transition-colors duration-150"
              >
                <span className="bg-accent-blue-text inline-block h-2 w-2 shrink-0 rounded-full transition-transform duration-150 group-hover:scale-125" />
                <button
                  type="button"
                  onClick={() => onEditEvent(event)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="text-heading truncate text-xs font-medium transition-transform duration-150 group-hover:translate-x-0.5">
                    {event.title}
                  </span>
                </button>
                <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => onEditEvent(event)}
                    className="text-muted hover:text-heading rounded p-0.5 transition-colors"
                  >
                    <Pencil size={10} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteEvent(event.id)}
                    className="text-muted hover:text-accent-red-text rounded p-0.5 transition-colors"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CalendarGrid({
  browseYear,
  browseMonth,
  config,
  currentDate,
  events = [],
  selectedDay,
  onDayClick,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  showMoonPhases = true,
}: CalendarGridProps) {
  const grid = getMonthGrid(browseYear, browseMonth, config);
  const isCurrentMonth =
    currentDate.year === browseYear && currentDate.month === browseMonth;

  const containerRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Map<number, HTMLTableCellElement>>(new Map());
  const [popoverAnchorRect, setPopoverAnchorRect] = useState<DOMRect | null>(
    null
  );
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

  // Update popover position when selectedDay changes
  useEffect(() => {
    if (
      selectedDay &&
      selectedDay.year === browseYear &&
      selectedDay.month === browseMonth
    ) {
      const cell = cellRefs.current.get(selectedDay.day);
      if (cell && containerRef.current) {
        setPopoverAnchorRect(cell.getBoundingClientRect());
        setContainerRect(containerRef.current.getBoundingClientRect());
      }
    } else {
      setPopoverAnchorRect(null);
    }
  }, [selectedDay, browseYear, browseMonth]);

  const setCellRef = useCallback(
    (day: number) => (el: HTMLTableCellElement | null) => {
      if (el) {
        cellRefs.current.set(day, el);
      } else {
        cellRefs.current.delete(day);
      }
    },
    []
  );

  const selectedDayEvents =
    selectedDay &&
    selectedDay.year === browseYear &&
    selectedDay.month === browseMonth
      ? events
          .filter(
            e =>
              e.year === selectedDay.year &&
              e.month === selectedDay.month &&
              e.day === selectedDay.day
          )
          .sort((a, b) => a.createdAt - b.createdAt)
      : [];

  const showPopover =
    selectedDay &&
    selectedDay.year === browseYear &&
    selectedDay.month === browseMonth &&
    popoverAnchorRect &&
    containerRect &&
    onAddEvent &&
    onEditEvent &&
    onDeleteEvent;

  return (
    <div className="relative" ref={containerRef}>
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
                  const isSelected =
                    selectedDay != null &&
                    selectedDay.year === browseYear &&
                    selectedDay.month === browseMonth &&
                    selectedDay.day === day;
                  const totalDays = getTotalDaysForDate(
                    browseYear,
                    browseMonth,
                    day,
                    config
                  );
                  const transitions = getPhaseTransitions(totalDays, config);
                  const dayEventCount = events.filter(
                    e =>
                      e.year === browseYear &&
                      e.month === browseMonth &&
                      e.day === day
                  ).length;

                  return (
                    <td
                      key={day}
                      ref={setCellRef(day)}
                      className={cn(
                        'border-divider border-b p-1 text-center align-top',
                        isToday && !isSelected && 'bg-accent-blue-bg',
                        isSelected && 'bg-accent-purple-bg'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onDayClick?.(browseYear, browseMonth, day)
                        }
                        className="mx-auto flex w-full flex-col items-center focus:outline-none"
                      >
                        <div
                          className={cn(
                            'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm',
                            isSelected
                              ? 'bg-accent-purple-bg text-accent-purple-text ring-accent-purple-border font-bold ring-2'
                              : isToday
                                ? 'bg-accent-blue-bg text-accent-blue-text ring-accent-blue-border font-bold ring-2'
                                : 'text-body hover:bg-surface-secondary'
                          )}
                        >
                          {day + 1}
                        </div>
                        {dayEventCount > 0 && (
                          <div className="mt-0.5 flex items-center justify-center gap-0.5">
                            {dayEventCount <= 3 ? (
                              Array.from({ length: dayEventCount }, (_, i) => (
                                <span
                                  key={i}
                                  className="bg-accent-blue-text inline-block h-1.5 w-1.5 rounded-full"
                                />
                              ))
                            ) : (
                              <>
                                <span className="bg-accent-blue-text inline-block h-1.5 w-1.5 rounded-full" />
                                <span className="bg-accent-blue-text inline-block h-1.5 w-1.5 rounded-full" />
                                <span className="bg-accent-blue-text inline-block h-1.5 w-1.5 rounded-full" />
                              </>
                            )}
                          </div>
                        )}
                      </button>
                      {showMoonPhases && transitions.length > 0 && (
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

      {showPopover && (
        <DayPopover
          selectedDay={selectedDay}
          events={selectedDayEvents}
          config={config}
          anchorRect={popoverAnchorRect}
          containerRect={containerRect}
          onAddEvent={onAddEvent}
          onEditEvent={onEditEvent}
          onDeleteEvent={onDeleteEvent}
          onClose={() =>
            onDayClick?.(selectedDay.year, selectedDay.month, selectedDay.day)
          }
        />
      )}
    </div>
  );
}
