// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EventDialog } from '@/components/ui/calendar/EventDialog';
import type { CalendarConfig, CalendarEvent } from '@/types/calendar';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// frimousse fetches emoji data from a CDN — stub it out entirely in jsdom.
// The fake Root exposes a button that simulates picking 🐉.
vi.mock('frimousse', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    EmojiPicker: {
      Root: ({
        onEmojiSelect,
        children,
      }: {
        onEmojiSelect: (e: { emoji: string; label: string }) => void;
        children?: React.ReactNode;
      }) => (
        <div>
          <button
            type="button"
            onClick={() => onEmojiSelect({ emoji: '🐉', label: 'dragon' })}
          >
            pick-dragon
          </button>
          {children}
        </div>
      ),
      Search: () => <input aria-label="Search emoji" />,
      Viewport: Passthrough,
      Loading: Passthrough,
      Empty: Passthrough,
      List: () => <div />,
    },
  };
});

const config: CalendarConfig = {
  clock: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
  weekDays: Array.from({ length: 7 }, (_, i) => ({ name: `Day ${i + 1}` })),
  months: [
    { name: 'Firstmonth', days: 30 },
    { name: 'Secondmonth', days: 30 },
  ],
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

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-1',
    title: 'Festival',
    description: '',
    year: 1,
    month: 0,
    day: 4,
    createdAt: 1000,
    ...overrides,
  };
}

const baseProps = {
  open: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
  config,
  defaultDate: { year: 1, month: 0, day: 4 },
};

describe('EventDialog marker section', () => {
  it('new event initializes to Dot mode with default blue', () => {
    render(<EventDialog {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Dot' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByLabelText('Marker color')).toHaveValue('#3b82f6');
  });

  it('event with emoji initializes to Emoji mode showing that emoji', () => {
    render(<EventDialog {...baseProps} event={makeEvent({ emoji: '🔥' })} />);
    expect(screen.getByRole('button', { name: 'Emoji' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(
      screen.getByRole('button', { name: 'Marker emoji: 🔥' })
    ).toBeInTheDocument();
  });

  it('event with valid color initializes Dot mode with that color', () => {
    render(
      <EventDialog {...baseProps} event={makeEvent({ color: '#ff0000' })} />
    );
    expect(screen.getByLabelText('Marker color')).toHaveValue('#ff0000');
  });

  it('event with invalid color initializes Dot mode with default blue', () => {
    render(<EventDialog {...baseProps} event={makeEvent({ color: 'red' })} />);
    expect(screen.getByLabelText('Marker color')).toHaveValue('#3b82f6');
  });

  it('marker state does not leak between events', () => {
    const { rerender } = render(
      <EventDialog {...baseProps} event={makeEvent({ emoji: '🔥' })} />
    );
    rerender(<EventDialog {...baseProps} open={false} event={undefined} />);
    rerender(<EventDialog {...baseProps} open={true} event={undefined} />);
    expect(screen.getByRole('button', { name: 'Dot' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByLabelText('Marker color')).toHaveValue('#3b82f6');
  });

  it('saving in Dot mode clears emoji', () => {
    const onSave = vi.fn();
    render(
      <EventDialog
        {...baseProps}
        onSave={onSave}
        event={makeEvent({ emoji: '🔥' })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ color: '#3b82f6', emoji: undefined })
    );
  });

  it('Emoji mode without selection disables Save; picking enables and saves cleared color', () => {
    const onSave = vi.fn();
    render(
      <EventDialog
        {...baseProps}
        onSave={onSave}
        event={makeEvent({ color: '#ff0000' })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }));
    const save = screen.getByRole('button', { name: 'Save Changes' });
    expect(save).toBeDisabled();

    // switching back to Dot re-enables Save
    fireEvent.click(screen.getByRole('button', { name: 'Dot' }));
    expect(save).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }));
    expect(save).toBeDisabled();

    fireEvent.click(
      screen.getByRole('button', { name: 'Marker emoji: none selected' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'pick-dragon' }));
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ emoji: '🐉', color: undefined })
    );
  });
});
