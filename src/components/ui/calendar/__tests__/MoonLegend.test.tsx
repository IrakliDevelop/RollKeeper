import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  dateToTime,
  getAllMoonPhases,
  timeToDate,
} from '@/utils/calendarCalculations';
import { createDefaultCalendar } from '@/utils/calendarPresets';
import { MoonLegend } from '../MoonLegend';

afterEach(cleanup);

const config = createDefaultCalendar();
const date = timeToDate(
  dateToTime(
    { year: 1, month: 0, dayOfMonth: 4, hour: 14, minute: 30, second: 0 },
    config
  ),
  config
);

function renderLegend() {
  return render(
    <MoonLegend
      config={config}
      currentMoonPhases={getAllMoonPhases(date.totalDays, config)}
    />
  );
}

describe('MoonLegend', () => {
  it('headings and phase labels are sentence case', () => {
    renderLegend();
    expect(
      screen.getByRole('heading', { level: 4, name: 'Current phase' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 4, name: 'Moon phases' })
    ).toBeInTheDocument();
    for (const name of [
      'New moon',
      'Waxing crescent',
      'First quarter',
      'Waxing gibbous',
      'Full moon',
      'Waning gibbous',
      'Last quarter',
      'Waning crescent',
    ]) {
      expect(screen.getAllByRole('img', { name }).length).toBeGreaterThan(0);
    }
  });

  it('cycle length is readable', () => {
    renderLegend();
    const cycle = screen.getByText('(28-day cycle)');
    expect(cycle).toHaveClass('text-muted');
    expect(cycle).not.toHaveClass('text-faint');
  });
});
