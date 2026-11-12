'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Settings, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { SubTabs } from '@/components/ui/layout/SubTabs';
import { TimeDisplay } from './TimeDisplay';
import { TimeControls } from './TimeControls';
import { WeatherPicker } from './WeatherPicker';
import { CalendarNav } from './CalendarNav';
import { CalendarGrid } from './CalendarGrid';
import { MoonLegend } from './MoonLegend';
import { EventDialog } from './EventDialog';
import { EventListView } from './EventListView';
import { JumpToDateDialog } from './JumpToDateDialog';
import { useCalendar } from '@/hooks/useCalendar';
import { useCalendarStore } from '@/store/calendarStore';
import { dateToTime, getCampaignDays } from '@/utils/calendarCalculations';
import type { SelectedDay } from './CalendarGrid';
import type { CalendarEvent, CalendarEventInput } from '@/types/calendar';

type CalendarTab = 'calendar' | 'events';

interface CalendarViewProps {
  campaignCode: string;
  onReset?: () => void;
}

export function CalendarView({ campaignCode, onReset }: CalendarViewProps) {
  const calendar = useCalendarStore(state =>
    state.calendars.find(c => c.campaignCode === campaignCode)
  );
  const advanceTime = useCalendarStore(state => state.advanceTime);
  const setCalendarTime = useCalendarStore(state => state.setTime);
  const setWeather = useCalendarStore(state => state.setWeather);
  const setStartDate = useCalendarStore(state => state.setStartDate);
  const addEvent = useCalendarStore(state => state.addEvent);
  const updateEvent = useCalendarStore(state => state.updateEvent);
  const deleteEvent = useCalendarStore(state => state.deleteEvent);
  const moveEvent = useCalendarStore(state => state.moveEvent);
  const { date, moonPhases, dayPeriod } = useCalendar(campaignCode);

  // Sub-tab state
  const [activeTab, setActiveTab] = useState<CalendarTab>('calendar');

  // Browse mode — tracks which month/year the grid is showing
  const [browseYear, setBrowseYear] = useState<number | null>(null);
  const [browseMonth, setBrowseMonth] = useState<number | null>(null);

  // Day selection and event dialog state
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(
    undefined
  );
  const [jumpDialogOpen, setJumpDialogOpen] = useState(false);

  if (!calendar || !date) return null;

  const config = calendar.config;
  const events = calendar.events ?? [];
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
    setBrowseYear(null);
    setBrowseMonth(null);
  };

  const handleDayClick = (year: number, month: number, day: number) => {
    if (
      selectedDay &&
      selectedDay.year === year &&
      selectedDay.month === month &&
      selectedDay.day === day
    ) {
      setSelectedDay(null);
    } else {
      setSelectedDay({ year, month, day });
    }
  };

  const handleAddEvent = () => {
    setEditingEvent(undefined);
    setEventDialogOpen(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEventDialogOpen(true);
  };

  const handleSaveEvent = (data: CalendarEventInput) => {
    if (editingEvent) {
      updateEvent(campaignCode, editingEvent.id, data);
    } else {
      addEvent(campaignCode, data);
    }
  };

  const handleDeleteEvent = () => {
    if (editingEvent) {
      deleteEvent(campaignCode, editingEvent.id);
    }
  };

  const handleSetStartDate = (year: number, month: number, day: number) => {
    const newTime = dateToTime(
      { year, month, dayOfMonth: day, hour: 0, minute: 0, second: 0 },
      config
    );
    setStartDate(campaignCode, newTime);
    setBrowseYear(null);
    setBrowseMonth(null);
  };

  const campaignDays = getCampaignDays(
    calendar.currentTime,
    calendar.startTime ?? 0,
    config
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <TimeDisplay
            date={date}
            config={config}
            moonPhases={moonPhases}
            dayPeriod={dayPeriod}
            weather={calendar.weather}
            onTimeEdit={(hour, minute) => {
              const newTime = dateToTime(
                { ...date, hour, minute, second: 0 },
                config
              );
              setCalendarTime(campaignCode, newTime);
            }}
          />
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<MapPin size={16} />}
                onClick={() => setJumpDialogOpen(true)}
              >
                Start date
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                leftIcon={<Settings size={16} />}
              >
                <Link href={`/dm/campaign/${campaignCode}/calendar/settings`}>
                  Settings
                </Link>
              </Button>
              {onReset && (
                <Button variant="danger" size="sm" onClick={onReset}>
                  Reset calendar
                </Button>
              )}
            </div>
            <p className="type-small text-muted">
              Day {campaignDays + 1} of the campaign
            </p>
          </div>
        </div>
        <div className="border-divider border-t pt-4">
          <TimeControls config={config} onAdvance={handleAdvance} />
        </div>
        <div className="border-divider border-t pt-4">
          <WeatherPicker
            current={calendar.weather}
            onChange={weather => setWeather(campaignCode, weather)}
          />
        </div>
      </div>

      <SubTabs
        label="Calendar and events"
        value={activeTab}
        onValueChange={value =>
          setActiveTab(value === 'events' ? 'events' : 'calendar')
        }
        tabs={[
          {
            value: 'calendar',
            id: 'calendar-tab',
            label: 'Calendar',
            content: (
              <>
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
                    events={events}
                    selectedDay={selectedDay}
                    onDayClick={handleDayClick}
                    onAddEvent={handleAddEvent}
                    onEditEvent={handleEditEvent}
                    onDeleteEvent={eventId =>
                      deleteEvent(campaignCode, eventId)
                    }
                    onMoveEvent={(eventId, direction) =>
                      moveEvent(campaignCode, eventId, direction)
                    }
                  />
                </div>
                {config.moons.length > 0 && (
                  <div className="border-divider mt-4 border-t pt-4">
                    <MoonLegend
                      config={config}
                      currentMoonPhases={moonPhases}
                    />
                  </div>
                )}
              </>
            ),
          },
          {
            value: 'events',
            id: 'calendar-events-tab',
            label: (
              <>
                Events
                {events.length > 0 && (
                  <>
                    {' '}
                    <Badge variant="neutral" size="sm">
                      {events.length}
                    </Badge>
                  </>
                )}
              </>
            ),
            content: (
              <EventListView
                events={events}
                config={config}
                onUpdateEvent={(eventId, updates) =>
                  updateEvent(campaignCode, eventId, updates)
                }
                onDeleteEvent={eventId => deleteEvent(campaignCode, eventId)}
                onMoveEvent={(eventId, direction) =>
                  moveEvent(campaignCode, eventId, direction)
                }
              />
            ),
          },
        ]}
      />

      {/* Event create/edit dialog (for calendar tab) */}
      <EventDialog
        open={eventDialogOpen}
        onClose={() => setEventDialogOpen(false)}
        onSave={handleSaveEvent}
        onDelete={editingEvent ? handleDeleteEvent : undefined}
        event={editingEvent}
        config={config}
        defaultDate={selectedDay ?? undefined}
      />

      {/* Start date dialog */}
      <JumpToDateDialog
        open={jumpDialogOpen}
        onClose={() => setJumpDialogOpen(false)}
        onJump={handleSetStartDate}
        config={config}
        currentDate={date}
      />
    </div>
  );
}
