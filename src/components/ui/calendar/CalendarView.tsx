'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Settings, RotateCcw, CalendarDays, List, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/layout/card';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { TimeDisplay } from './TimeDisplay';
import { TimeControls } from './TimeControls';
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
import type { CalendarEvent } from '@/types/calendar';

type CalendarTab = 'calendar' | 'events';

const TABS: { id: CalendarTab; label: string; icon: React.ReactNode }[] = [
  { id: 'calendar', label: 'Calendar', icon: <CalendarDays size={14} /> },
  { id: 'events', label: 'Events', icon: <List size={14} /> },
];

interface CalendarViewProps {
  campaignCode: string;
  onReset?: () => void;
}

export function CalendarView({ campaignCode, onReset }: CalendarViewProps) {
  const calendar = useCalendarStore(state =>
    state.calendars.find(c => c.campaignCode === campaignCode)
  );
  const advanceTime = useCalendarStore(state => state.advanceTime);
  const setStartDate = useCalendarStore(state => state.setStartDate);
  const addEvent = useCalendarStore(state => state.addEvent);
  const updateEvent = useCalendarStore(state => state.updateEvent);
  const deleteEvent = useCalendarStore(state => state.deleteEvent);
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

  const handleSaveEvent = (data: {
    title: string;
    description: string;
    year: number;
    month: number;
    day: number;
  }) => {
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
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<MapPin size={16} />}
                  onClick={() => setJumpDialogOpen(true)}
                >
                  Start Date
                </Button>
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
              <span className="text-muted text-sm">
                Day {campaignDays + 1} of the campaign
              </span>
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

      {/* Sub-tab switcher */}
      <div className="bg-surface-secondary inline-flex rounded-lg p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-surface-raised text-heading shadow-sm'
                : 'text-muted hover:text-body'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.id === 'events' && events.length > 0 && (
              <Badge variant="neutral" className="ml-1">
                {events.length}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'calendar' ? (
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
                events={events}
                selectedDay={selectedDay}
                onDayClick={handleDayClick}
                onAddEvent={handleAddEvent}
                onEditEvent={handleEditEvent}
                onDeleteEvent={eventId => deleteEvent(campaignCode, eventId)}
              />
            </div>
            {config.moons.length > 0 && (
              <div className="border-divider mt-4 border-t pt-4">
                <MoonLegend config={config} currentMoonPhases={moonPhases} />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <EventListView
              events={events}
              config={config}
              onUpdateEvent={(eventId, updates) =>
                updateEvent(campaignCode, eventId, updates)
              }
              onDeleteEvent={eventId => deleteEvent(campaignCode, eventId)}
            />
          </CardContent>
        </Card>
      )}

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
