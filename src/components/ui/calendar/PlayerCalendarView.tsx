'use client';

import { useState } from 'react';
import {
  Moon,
  CalendarDays,
  List,
  RotateCcw,
  Undo2,
  MapPin,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { CalendarNav } from './CalendarNav';
import { CalendarGrid } from './CalendarGrid';
import { EventDialog } from './EventDialog';
import { EventListView } from './EventListView';
import { JumpToDateDialog } from './JumpToDateDialog';
import { useCalendar } from '@/hooks/useCalendar';
import { useCalendarStore } from '@/store/calendarStore';
import { useCharacterStore } from '@/store/characterStore';
import { useSharedCampaignState } from '@/hooks/useSharedCampaignState';
import { useTimeAgo } from '@/hooks/useTimeAgo';
import { CALENDAR_PRESETS } from '@/utils/calendarPresets';
import {
  getMsPerDay,
  timeToDate,
  dateToTime,
  getCampaignDays,
} from '@/utils/calendarCalculations';
import type { SelectedDay } from './CalendarGrid';
import type { ToastData } from '@/components/ui/feedback/Toast';
import type { CalendarEvent } from '@/types/calendar';

type PlayerTab = 'calendar' | 'events';

const TABS: { id: PlayerTab; label: string; icon: React.ReactNode }[] = [
  { id: 'calendar', label: 'Calendar', icon: <CalendarDays size={14} /> },
  { id: 'events', label: 'Events', icon: <List size={14} /> },
];

function getPresetDescription(id: string): string {
  switch (id) {
    case 'default':
      return '7-day weeks, 12 months of 30 days, 4 seasons';
    case 'harptos':
      return 'Faer\u00fbn calendar with 10-day tendays, 5 holidays';
    case 'greyhawk':
      return '7-day weeks, 12 months of 28 days, 4 festivals';
    case 'barovia':
      return '7-day weeks, 12 months of 28 days, 28-day moon cycle';
    default:
      return '';
  }
}

interface PlayerCalendarViewProps {
  characterId: string;
  campaignCode?: string;
  addToast?: (toast: Omit<ToastData, 'id'>) => void;
}

export function PlayerCalendarView({
  characterId,
  campaignCode,
  addToast,
}: PlayerCalendarViewProps) {
  const { exists, date: localDate } = useCalendar(characterId);
  const takeLongRest = useCharacterStore(state => state.takeLongRest);
  const calendar = useCalendarStore(state =>
    state.calendars.find(c => c.campaignCode === characterId)
  );
  const initCalendar = useCalendarStore(state => state.initCalendar);
  const deleteCalendar = useCalendarStore(state => state.deleteCalendar);
  const advanceTime = useCalendarStore(state => state.advanceTime);
  const addEvent = useCalendarStore(state => state.addEvent);
  const updateEvent = useCalendarStore(state => state.updateEvent);
  const deleteEvent = useCalendarStore(state => state.deleteEvent);
  const setStartDate = useCalendarStore(state => state.setStartDate);

  // Shared state from DM (only when in a campaign)
  const { sharedState, lastFetched } = useSharedCampaignState(campaignCode);
  const sharedCalendar = sharedState?.calendar ?? null;
  const lastFetchedAgo = useTimeAgo(lastFetched);

  // Synced mode: campaign code exists AND DM has shared calendar data
  const isSynced = !!campaignCode && !!sharedCalendar;

  // Derive date and config from shared state when synced
  const syncedDate = isSynced
    ? timeToDate(sharedCalendar.currentTime, sharedCalendar.config)
    : null;
  const syncedConfig = isSynced ? sharedCalendar.config : null;

  // Effective values (synced or local)
  const date = syncedDate ?? localDate;
  const config = syncedConfig ?? calendar?.config;

  const [selectedPreset, setSelectedPreset] = useState<string>(
    CALENDAR_PRESETS[0].id
  );
  const [confirmingReset, setConfirmingReset] = useState(false);

  const [activeTab, setActiveTab] = useState<PlayerTab>('calendar');
  const [browseYear, setBrowseYear] = useState<number | null>(null);
  const [browseMonth, setBrowseMonth] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>();
  const [jumpDialogOpen, setJumpDialogOpen] = useState(false);

  // Setup state — only show when NOT synced and no local calendar
  if (!isSynced && (!exists || !calendar || !localDate)) {
    const handleCreate = () => {
      const preset = CALENDAR_PRESETS.find(p => p.id === selectedPreset);
      if (!preset) return;
      initCalendar(characterId, preset.create());
    };

    return (
      <div className="space-y-4">
        <p className="text-body text-sm">
          Choose a calendar to track in-game time and events for this character.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {CALENDAR_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => setSelectedPreset(preset.id)}
              className={`rounded-lg border-2 p-3 text-left transition-all ${
                selectedPreset === preset.id
                  ? 'border-accent-blue-border bg-accent-blue-bg'
                  : 'border-divider bg-surface hover:bg-surface-secondary'
              }`}
            >
              <span className="text-heading text-sm font-semibold">
                {preset.name}
              </span>
              <p className="text-muted mt-1 text-xs">
                {getPresetDescription(preset.id)}
              </p>
            </button>
          ))}
        </div>
        <Button variant="primary" size="sm" onClick={handleCreate}>
          Create Calendar
        </Button>
      </div>
    );
  }

  // Guard — at this point we must have date and config
  if (!date || !config) {
    return (
      <div className="text-muted py-8 text-center text-sm">
        Waiting for calendar data from DM...
      </div>
    );
  }

  // Active state
  const events = isSynced ? [] : (calendar?.events ?? []);
  const displayYear = browseYear ?? date.year;
  const displayMonth = browseMonth ?? date.month;
  const isBrowsing = browseYear !== null || browseMonth !== null;

  const campaignDays = isSynced
    ? getCampaignDays(
        sharedCalendar.currentTime,
        sharedCalendar.startTime,
        sharedCalendar.config
      )
    : calendar
      ? getCampaignDays(calendar.currentTime, calendar.startTime ?? 0, config)
      : 0;

  const handleLongRest = () => {
    takeLongRest();
    if (!isSynced) {
      advanceTime(characterId, getMsPerDay(config));
    }
    setBrowseYear(null);
    setBrowseMonth(null);
    const details = [
      'All abilities restored',
      'All spell slots restored',
      'Hit points fully restored',
      'Hit dice partially restored',
    ];
    if (!isSynced) {
      details.push('Calendar advanced by 1 day');
    }
    addToast?.({
      type: 'rest',
      title: '\u{1F319} Long Rest Complete',
      message:
        'Your character has taken a long rest' +
        (isSynced ? '' : ' and a new day begins'),
      details,
      duration: 6000,
    });
  };

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

  const handleDayClick = (year: number, month: number, day: number) => {
    if (isSynced) return; // No day interaction in synced mode
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
    if (isSynced) return;
    setEditingEvent(undefined);
    setEventDialogOpen(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    if (isSynced) return;
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
      updateEvent(characterId, editingEvent.id, data);
    } else {
      addEvent(characterId, data);
    }
  };

  const handleDeleteEvent = () => {
    if (editingEvent) {
      deleteEvent(characterId, editingEvent.id);
    }
  };

  const handleReset = () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    deleteCalendar(characterId);
    setConfirmingReset(false);
  };

  const handleSetStartDate = (year: number, month: number, day: number) => {
    const newTime = dateToTime(
      { year, month, dayOfMonth: day, hour: 0, minute: 0, second: 0 },
      config
    );
    setStartDate(characterId, newTime);
    setBrowseYear(null);
    setBrowseMonth(null);
  };

  const monthName =
    config.months[date.month]?.name ?? `Month ${date.month + 1}`;
  const era = config.eras.find(
    e =>
      date.year >= e.startYear &&
      (e.endYear === undefined || date.year <= e.endYear)
  );
  const eraStr = era ? ` ${era.abbreviation}` : '';

  return (
    <div className="space-y-4">
      {/* Date header + controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-heading text-base font-semibold">
            {date.dayOfMonth + 1} {monthName}, Year {date.year}
            {eraStr}
          </h3>
          {date.season && <Badge variant="info">{date.season.name}</Badge>}
          {isSynced && (
            <>
              <Badge variant="success">
                <Link2 size={10} className="mr-1 inline" />
                Synced with DM
              </Badge>
              {lastFetchedAgo && (
                <span className="text-faint text-xs">{lastFetchedAgo}</span>
              )}
            </>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            {/* Hide Start Date, Prev Day, Reset in synced mode */}
            {!isSynced && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<MapPin size={14} />}
                  onClick={() => setJumpDialogOpen(true)}
                  title="Set campaign start date"
                >
                  Start Date
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Undo2 size={14} />}
                  onClick={() => {
                    advanceTime(characterId, -getMsPerDay(config));
                    setBrowseYear(null);
                    setBrowseMonth(null);
                  }}
                  title="Go back one day"
                >
                  Prev Day
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Moon size={14} />}
              onClick={handleLongRest}
            >
              Long Rest
            </Button>
            {!isSynced && (
              <>
                {confirmingReset ? (
                  <div className="flex items-center gap-1">
                    <Button variant="danger" size="sm" onClick={handleReset}>
                      Confirm
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingReset(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<RotateCcw size={14} />}
                    onClick={handleReset}
                  >
                    Reset
                  </Button>
                )}
              </>
            )}
          </div>
          <span className="text-muted text-xs">
            Day {campaignDays + 1} of the campaign
          </span>
        </div>
      </div>

      {/* Sub-tab switcher — hide Events tab in synced mode */}
      {!isSynced && (
        <div className="bg-surface-secondary inline-flex rounded-lg p-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
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
      )}

      {/* Tab content */}
      {activeTab === 'calendar' || isSynced ? (
        <div>
          <CalendarNav
            browseYear={displayYear}
            browseMonth={displayMonth}
            config={config}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onToday={handleToday}
            isBrowsing={isBrowsing}
          />
          <div className="mt-3">
            <CalendarGrid
              browseYear={displayYear}
              browseMonth={displayMonth}
              config={config}
              currentDate={date}
              events={events}
              selectedDay={isSynced ? null : selectedDay}
              onDayClick={handleDayClick}
              onAddEvent={isSynced ? undefined : handleAddEvent}
              onEditEvent={isSynced ? undefined : handleEditEvent}
              onDeleteEvent={
                isSynced
                  ? undefined
                  : eventId => deleteEvent(characterId, eventId)
              }
              showMoonPhases={false}
            />
          </div>
        </div>
      ) : (
        <EventListView
          events={events}
          config={config}
          onUpdateEvent={(eventId, updates) =>
            updateEvent(characterId, eventId, updates)
          }
          onDeleteEvent={eventId => deleteEvent(characterId, eventId)}
        />
      )}

      {!isSynced && (
        <>
          <EventDialog
            open={eventDialogOpen}
            onClose={() => setEventDialogOpen(false)}
            onSave={handleSaveEvent}
            onDelete={editingEvent ? handleDeleteEvent : undefined}
            event={editingEvent}
            config={config}
            defaultDate={selectedDay ?? undefined}
          />

          <JumpToDateDialog
            open={jumpDialogOpen}
            onClose={() => setJumpDialogOpen(false)}
            onJump={handleSetStartDate}
            config={config}
            currentDate={date}
          />
        </>
      )}
    </div>
  );
}
