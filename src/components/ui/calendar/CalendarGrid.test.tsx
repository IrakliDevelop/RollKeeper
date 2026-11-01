import { useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ConfirmDialogHost,
  cancelAllDialogs,
} from '@/components/ui/feedback/confirm-dialog';
import type { CalendarConfig, CalendarEvent } from '@/types/calendar';
import { CalendarGrid, type SelectedDay } from './CalendarGrid';

const config: CalendarConfig = {
  clock: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
  weekDays: [{ name: 'First' }, { name: 'Second' }],
  months: [{ name: 'Hammer', days: 2 }],
  seasons: [],
  moons: [],
  namedYears: [],
  eras: [],
  yearOffset: 0,
  yearStartWeekdayOffset: 0,
  mechanics: {
    hoursPerLongRest: 8,
    minutesPerShortRest: 60,
    secondsPerRound: 6,
  },
};
const event: CalendarEvent = {
  id: 'event-1',
  title: 'Market',
  description: '',
  year: 1,
  month: 0,
  day: 0,
  createdAt: 1,
};

afterEach(() => {
  cancelAllDialogs();
  cleanup();
});

function Harness({ onDelete }: { onDelete: (id: string) => void }) {
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>({
    year: 1,
    month: 0,
    day: 0,
  });
  const [events, setEvents] = useState([event]);
  return (
    <>
      <ConfirmDialogHost />
      <CalendarGrid
        browseYear={1}
        browseMonth={0}
        config={config}
        currentDate={{ year: 1, month: 0, dayOfMonth: 0 } as never}
        events={events}
        selectedDay={selectedDay}
        onDayClick={() =>
          setSelectedDay(current =>
            current ? null : { year: 1, month: 0, day: 0 }
          )
        }
        onAddEvent={vi.fn()}
        onEditEvent={vi.fn()}
        onDeleteEvent={id => {
          onDelete(id);
          setEvents(current => current.filter(item => item.id !== id));
        }}
      />
    </>
  );
}

describe('CalendarGrid', () => {
  it('keeps the day popover and focus when the delete confirm is cancelled', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<Harness onDelete={onDelete} />);
    const deleteButton = await screen.findByRole('button', {
      name: 'Delete Market',
    });
    await user.click(deleteButton);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edit Market' })).toBeVisible()
    );
    expect(document.activeElement).not.toBe(document.body);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('keeps the day popover and focuses Add event after confirming deletion', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<Harness onDelete={onDelete} />);
    await user.click(
      await screen.findByRole('button', { name: 'Delete Market' })
    );
    await user.click(screen.getByRole('button', { name: 'Delete event' }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('event-1'));
    const add = await screen.findByRole('button', { name: 'Add event' });
    await waitFor(() => expect(add).toHaveFocus());
  });
});
