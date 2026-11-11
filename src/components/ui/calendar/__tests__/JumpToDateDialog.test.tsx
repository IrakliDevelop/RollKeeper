import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHarptosCalendar } from '@/utils/calendarPresets';
import type { CalendarConfig, CalendarDate } from '@/types/calendar';
import { JumpToDateDialog } from '../JumpToDateDialog';

afterEach(cleanup);

const harptos: CalendarConfig = createHarptosCalendar();
const currentDate = {
  year: 1492,
  month: 0,
  dayOfMonth: 4,
} as unknown as CalendarDate;

function renderDialog() {
  const onJump = vi.fn();
  const onClose = vi.fn();
  render(
    <JumpToDateDialog
      open
      onClose={onClose}
      onJump={onJump}
      config={harptos}
      currentDate={currentDate}
    />
  );
  return { onJump, onClose };
}

describe('JumpToDateDialog', () => {
  it('asks for the campaign start date', () => {
    renderDialog();
    expect(
      screen.getByRole('dialog', { name: 'Campaign start date' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'The day counter starts on this date, and the current time moves to it.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Year' })).toHaveValue('1492');
    expect(screen.getByText('Year').tagName).toBe('LABEL');
  });

  it('Set start date sends the chosen date and closes', () => {
    const { onJump, onClose } = renderDialog();
    fireEvent.change(screen.getByRole('textbox', { name: 'Year' }), {
      target: { value: '1490' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set start date' }));

    expect(onJump).toHaveBeenCalledWith(1490, 0, 4);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
