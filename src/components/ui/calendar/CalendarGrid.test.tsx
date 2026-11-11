import { useState } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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

  it('names each day and marks selection and today', () => {
    render(<Harness onDelete={vi.fn()} />);
    const day1 = screen.getByRole('button', { name: '1 Hammer 1' });
    expect(day1).toHaveAttribute('aria-pressed', 'true');
    expect(day1).toHaveAttribute('aria-current', 'date');
    expect(day1).toHaveClass(
      'focus-visible:ring-brass-fill',
      'focus-visible:ring-2',
      'focus-visible:outline-none'
    );
    expect(day1).not.toHaveClass('focus:outline-none');

    const day2 = screen.getByRole('button', { name: '2 Hammer 1' });
    expect(day2).toHaveAttribute('aria-pressed', 'false');
    expect(day2).not.toHaveAttribute('aria-current');
  });

  it('marks selected with a brass ring and today with a neutral fill', () => {
    const { container } = render(
      <CalendarGrid
        browseYear={1}
        browseMonth={0}
        config={config}
        currentDate={{ year: 1, month: 0, dayOfMonth: 0 } as never}
        selectedDay={{ year: 1, month: 0, day: 1 }}
      />
    );
    const today = screen.getByRole('button', { name: '1 Hammer 1' })
      .firstElementChild as HTMLElement;
    expect(today).toHaveClass('bg-surface-secondary', 'text-heading');
    expect(today).toHaveClass('font-semibold');
    expect(today).not.toHaveClass('ring-brass-border');

    const selected = screen.getByRole('button', { name: '2 Hammer 1' })
      .firstElementChild as HTMLElement;
    expect(selected).toHaveClass('ring-brass-border', 'ring-2', 'text-heading');
    expect(selected).toHaveClass('font-semibold');
    expect(selected).not.toHaveClass('bg-surface-secondary');

    for (const td of container.querySelectorAll('td')) {
      expect(td.className).not.toMatch(/\bbg-/);
    }
    expect(container.querySelector('[class*="accent-"]')).toBeNull();
  });

  it('gives short weekday headers a full name for screen readers, without a tooltip', () => {
    render(<Harness onDelete={vi.fn()} />);
    const th = screen.getAllByRole('columnheader')[0];
    expect(within(th).getByText('Fir')).toHaveAttribute('aria-hidden', 'true');
    expect(th.querySelector('.sr-only')!.textContent).toBe('First');
    expect(th.querySelector('[data-state]')).toBeNull();
  });

  it('Escape in the popover closes it and returns focus to the day', async () => {
    const user = userEvent.setup();
    render(<Harness onDelete={vi.fn()} />);
    screen.getByRole('button', { name: 'Edit Market' }).focus();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('button', { name: 'Add event' })).toBeNull();
    expect(screen.getByRole('button', { name: '1 Hammer 1' })).toHaveFocus();
  });

  it('Escape in the delete confirm keeps the popover', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<Harness onDelete={onDelete} />);
    await user.click(
      await screen.findByRole('button', { name: 'Delete Market' })
    );
    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edit Market' })).toBeVisible()
    );
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('re-measures the popover on resize and on wrapper scroll', () => {
    let cellLeft = 100;
    const rect = (left: number, top: number, width: number, height: number) =>
      ({
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
    const spy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: Element) {
        if (this.tagName === 'TD') return rect(cellLeft, 20, 40, 40);
        if (this.classList.contains('relative')) return rect(0, 0, 400, 300);
        return rect(0, 0, 0, 0);
      });
    try {
      const { container } = render(<Harness onDelete={vi.fn()} />);
      const pop = screen
        .getByRole('button', { name: 'Add event' })
        .closest('.absolute') as HTMLElement;
      expect(pop.style.left).toBe('10px');
      expect(pop.style.top).toBe('64px');

      cellLeft = 200;
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(pop.style.left).toBe('110px');

      cellLeft = 150;
      fireEvent.scroll(container.querySelector('.overflow-x-auto')!);
      expect(pop.style.left).toBe('60px');
    } finally {
      spy.mockRestore();
    }
  });

  it('the +N overflow count is readable', () => {
    const many: CalendarEvent[] = Array.from({ length: 7 }, (_, i) => ({
      ...event,
      id: `many-${i}`,
      title: `Event ${i}`,
    }));
    render(
      <CalendarGrid
        browseYear={1}
        browseMonth={0}
        config={config}
        currentDate={{ year: 1, month: 0, dayOfMonth: 0 } as never}
        events={many}
      />
    );
    const count = screen.getByText('+2');
    expect(count).toHaveClass('text-muted');
    expect(count).not.toHaveClass('text-faint');
  });
});
