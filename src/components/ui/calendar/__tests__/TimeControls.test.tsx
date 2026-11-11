import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultCalendar } from '@/utils/calendarPresets';
import { TimeControls } from '../TimeControls';

afterEach(cleanup);

const config = createDefaultCalendar();

function renderControls() {
  const onAdvance = vi.fn();
  const view = render(<TimeControls config={config} onAdvance={onAdvance} />);
  return { onAdvance, ...view };
}

describe('TimeControls', () => {
  it('groups the steppers under plain labels', () => {
    const { container } = renderControls();
    for (const name of ['Rewind', 'Advance', 'Rests']) {
      const group = screen.getByRole('group', { name });
      const label = within(group).getByText(name);
      expect(label).toHaveClass('type-label-heading', 'text-muted');
      expect(label.className).not.toMatch(/tracking-/);
    }
    for (const button of container.querySelectorAll('button')) {
      expect(button.querySelector('svg')).toBeNull();
    }
  });

  it.each([
    ['−1 day', 'Rewind 1 day', -86_400_000],
    ['−1 hour', 'Rewind 1 hour', -3_600_000],
    ['−1 min', 'Rewind 1 minute', -60_000],
    ['+1 round', 'Advance 1 round', 6_000],
    ['+1 min', 'Advance 1 minute', 60_000],
    ['+1 hour', 'Advance 1 hour', 3_600_000],
    ['+1 day', 'Advance 1 day', 86_400_000],
    ['+1 week', 'Advance 1 week', 604_800_000],
  ])('%s advances by %s', (text, aria, ms) => {
    const { onAdvance } = renderControls();
    const button = screen.getByRole('button', { name: aria });
    expect(button).toHaveTextContent(text);
    fireEvent.click(button);
    expect(onAdvance).toHaveBeenLastCalledWith(ms);
  });

  it('rests advance by the configured rest', () => {
    const { onAdvance } = renderControls();
    const short = screen.getByRole('button', { name: 'Short rest' });
    const long = screen.getByRole('button', { name: 'Long rest' });
    fireEvent.click(short);
    expect(onAdvance).toHaveBeenLastCalledWith(3_600_000);
    fireEvent.click(long);
    expect(onAdvance).toHaveBeenLastCalledWith(28_800_000);
    expect(short).toHaveAttribute('data-variant', 'outline');
    expect(long).toHaveAttribute('data-variant', 'outline');
  });
});
