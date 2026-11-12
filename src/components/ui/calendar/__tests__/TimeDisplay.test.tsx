import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dateToTime, timeToDate } from '@/utils/calendarCalculations';
import { createDefaultCalendar } from '@/utils/calendarPresets';
import { TimeDisplay } from '../TimeDisplay';

afterEach(cleanup);

const config = createDefaultCalendar();
const date = timeToDate(
  dateToTime(
    { year: 1, month: 0, dayOfMonth: 4, hour: 14, minute: 30, second: 0 },
    config
  ),
  config
);

function renderDisplay(
  props: Partial<React.ComponentProps<typeof TimeDisplay>> = {}
) {
  return render(
    <TimeDisplay
      date={date}
      config={config}
      moonPhases={[]}
      dayPeriod="Afternoon"
      {...props}
    />
  );
}

describe('TimeDisplay', () => {
  it('shows the clock as plain numbers', () => {
    renderDisplay();
    const clock = screen.getByText('14:30');
    expect(clock.tagName).toBe('SPAN');
    expect(clock).toHaveClass('type-num-lg', 'text-heading', 'tabular-nums');
    expect(clock.className).not.toMatch(/font-mono|tracking-/);
  });

  it('Edit time is a visible button that opens the dialog', () => {
    const onTimeEdit = vi.fn();
    const { unmount } = renderDisplay({ onTimeEdit });
    fireEvent.click(screen.getByRole('button', { name: 'Edit time' }));
    expect(
      screen.getByRole('dialog', { name: 'Edit time' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Set time' }));
    expect(onTimeEdit).toHaveBeenCalledWith(14, 30);
    unmount();

    renderDisplay();
    expect(screen.queryByRole('button', { name: 'Edit time' })).toBeNull();
  });

  it('uses a neutral period icon and no hues', () => {
    const { container } = renderDisplay();
    expect(container.querySelector('svg.lucide-sun')).toHaveClass('text-muted');
    expect(container.querySelector('[class*="accent-"]')).toBeNull();
    expect(container.querySelector('[title]')).toBeNull();
  });

  it('writes the moon phase in sentence case', () => {
    renderDisplay({
      moonPhases: [
        { moon: config.moons[0], phase: 'full-moon', phaseIndex: 4 },
      ],
      weather: 'heavy-rain',
    });
    expect(screen.getByText('Moon: Full moon')).toBeInTheDocument();
    expect(screen.getByText('Heavy rain')).toBeInTheDocument();
  });
});
