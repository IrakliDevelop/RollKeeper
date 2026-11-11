import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dateToTime, timeToDate } from '@/utils/calendarCalculations';
import { createDefaultCalendar } from '@/utils/calendarPresets';
import { TimeEditDialog } from '../TimeEditDialog';

afterEach(cleanup);

const config = createDefaultCalendar();
const at = (hour: number, minute: number) =>
  timeToDate(
    dateToTime(
      { year: 1, month: 0, dayOfMonth: 4, hour, minute, second: 0 },
      config
    ),
    config
  );
const date = at(14, 30);

function renderDialog(open = true) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <TimeEditDialog
      open={open}
      onClose={onClose}
      date={date}
      config={config}
      onSave={onSave}
    />
  );
  return { onSave, onClose, ...view };
}

describe('TimeEditDialog', () => {
  it('opens on the current hour and minute', async () => {
    renderDialog();
    expect(
      screen.getByRole('dialog', { name: 'Edit time' })
    ).toBeInTheDocument();
    const hour = screen.getByRole('textbox', { name: 'Hour' });
    expect(hour).toHaveValue('14');
    await waitFor(() => expect(hour).toHaveFocus());
    expect(screen.getByRole('textbox', { name: 'Minute' })).toHaveValue('30');
  });

  it('Set time saves and closes', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderDialog();
    const hour = screen.getByRole('textbox', { name: 'Hour' });
    await user.clear(hour);
    await user.type(hour, '9');
    await user.click(screen.getByRole('button', { name: 'Set time' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(9, 30);
    expect(onClose).toHaveBeenCalled();
  });

  it('Enter submits and clamps to the clock', async () => {
    const user = userEvent.setup();
    const first = renderDialog();
    const minute = screen.getByRole('textbox', { name: 'Minute' });
    await user.clear(minute);
    await user.type(minute, '75{Enter}');
    expect(first.onSave).toHaveBeenCalledWith(14, 59);
    cleanup();

    const second = renderDialog();
    const hour = screen.getByRole('textbox', { name: 'Hour' });
    await user.clear(hour);
    await user.type(hour, '30{Enter}');
    expect(second.onSave).toHaveBeenCalledWith(23, 30);
  });

  it('Escape discards the draft', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderDialog();
    const hour = screen.getByRole('textbox', { name: 'Hour' });
    await user.clear(hour);
    await user.type(hour, '5{Escape}');
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('reopens on the current time', () => {
    const { rerender } = renderDialog();
    const props = { onClose: vi.fn(), config, onSave: vi.fn() };
    rerender(<TimeEditDialog open={false} date={date} {...props} />);
    rerender(<TimeEditDialog open date={at(8, 15)} {...props} />);
    expect(screen.getByRole('textbox', { name: 'Hour' })).toHaveValue('8');
    expect(screen.getByRole('textbox', { name: 'Minute' })).toHaveValue('15');
  });

  it('has one primary button', () => {
    renderDialog();
    const primary = document.querySelectorAll('[data-variant="primary"]');
    expect(primary).toHaveLength(1);
    expect(primary[0]).toHaveAccessibleName('Set time');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute(
      'data-variant',
      'ghost'
    );
  });
});
