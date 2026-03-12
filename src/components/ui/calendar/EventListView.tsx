'use client';

import { useState, useMemo } from 'react';
import { Search, Pencil, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { EventDialog } from './EventDialog';
import type { CalendarConfig, CalendarEvent } from '@/types/calendar';

type SortOrder = 'date-asc' | 'date-desc' | 'recent';

interface EventListViewProps {
  events: CalendarEvent[];
  config: CalendarConfig;
  onUpdateEvent: (
    eventId: string,
    updates: Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>
  ) => void;
  onDeleteEvent: (eventId: string) => void;
}

function compareDateKeys(a: CalendarEvent, b: CalendarEvent): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function dateKey(e: CalendarEvent): string {
  return `${e.year}-${e.month}-${e.day}`;
}

export function EventListView({
  events,
  config,
  onUpdateEvent,
  onDeleteEvent,
}: EventListViewProps) {
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('date-asc');

  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    let result = events;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e => e.title.toLowerCase().includes(q));
    }

    if (monthFilter !== 'all') {
      const m = Number(monthFilter);
      result = result.filter(e => e.month === m);
    }

    if (yearFilter !== '') {
      const y = Number(yearFilter);
      if (!isNaN(y)) {
        result = result.filter(e => e.year === y);
      }
    }

    const sorted = [...result];
    switch (sortOrder) {
      case 'date-asc':
        sorted.sort(compareDateKeys);
        break;
      case 'date-desc':
        sorted.sort((a, b) => compareDateKeys(b, a));
        break;
      case 'recent':
        sorted.sort((a, b) => b.createdAt - a.createdAt);
        break;
    }

    return sorted;
  }, [events, search, monthFilter, yearFilter, sortOrder]);

  // Group events by date
  const grouped = useMemo(() => {
    const groups: {
      key: string;
      year: number;
      month: number;
      day: number;
      events: CalendarEvent[];
    }[] = [];
    for (const event of filtered) {
      const k = dateKey(event);
      const last = groups[groups.length - 1];
      if (last && last.key === k) {
        last.events.push(event);
      } else {
        groups.push({
          key: k,
          year: event.year,
          month: event.month,
          day: event.day,
          events: [event],
        });
      }
    }
    return groups;
  }, [filtered]);

  const formatGroupDate = (year: number, month: number, day: number) => {
    const monthName = config.months[month]?.name ?? `Month ${month + 1}`;
    const era = config.eras.find(
      e => year >= e.startYear && (e.endYear === undefined || year <= e.endYear)
    );
    const eraStr = era ? ` ${era.abbreviation}` : '';
    return `${day + 1} ${monthName}, Year ${year}${eraStr}`;
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setDialogOpen(true);
  };

  const handleSave = (data: {
    title: string;
    description: string;
    year: number;
    month: number;
    day: number;
  }) => {
    if (editingEvent) {
      onUpdateEvent(editingEvent.id, data);
    }
  };

  const handleDelete = () => {
    if (editingEvent) {
      onDeleteEvent(editingEvent.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2">
          <Input
            placeholder="Search events..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            leftIcon={<Search size={14} className="text-muted" />}
          />
        </div>
        <SelectField value={monthFilter} onValueChange={setMonthFilter}>
          <SelectItem value="all">All months</SelectItem>
          {config.months.map((m, i) => (
            <SelectItem key={i} value={String(i)}>
              {m.name}
            </SelectItem>
          ))}
        </SelectField>
        <SelectField
          value={sortOrder}
          onValueChange={v => setSortOrder(v as SortOrder)}
        >
          <SelectItem value="date-asc">Date (oldest)</SelectItem>
          <SelectItem value="date-desc">Date (newest)</SelectItem>
          <SelectItem value="recent">Recently added</SelectItem>
        </SelectField>
      </div>

      <div>
        <Input
          type="number"
          placeholder="Filter by year..."
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value)}
          className="max-w-48"
        />
      </div>

      {/* Event list */}
      {events.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted text-sm">
            No events yet. Click a day on the Calendar tab to add one.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted text-sm">No events match your filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <div key={group.key}>
              <h3 className="text-muted mb-1.5 text-xs font-semibold tracking-wide uppercase">
                {formatGroupDate(group.year, group.month, group.day)}
              </h3>
              <div className="bg-surface-secondary rounded-lg">
                {group.events.map(event => (
                  <div
                    key={event.id}
                    className="hover:bg-surface-elevated border-divider group flex w-full items-center gap-2 border-b px-3 py-2.5 transition-colors duration-150 last:border-b-0"
                  >
                    <span className="bg-accent-blue-text inline-block h-2 w-2 shrink-0 rounded-full transition-transform duration-150 group-hover:scale-125" />
                    <button
                      type="button"
                      onClick={() => handleEditEvent(event)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="text-heading truncate text-sm font-medium transition-transform duration-150 group-hover:translate-x-0.5">
                        {event.title}
                      </span>
                    </button>
                    <div className="ml-auto flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleEditEvent(event)}
                        className="text-muted hover:text-heading rounded p-1 transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteEvent(event.id)}
                        className="text-muted hover:text-accent-red-text rounded p-1 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <EventDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        event={editingEvent}
        config={config}
        defaultDate={
          editingEvent
            ? {
                year: editingEvent.year,
                month: editingEvent.month,
                day: editingEvent.day,
              }
            : undefined
        }
      />
    </div>
  );
}
