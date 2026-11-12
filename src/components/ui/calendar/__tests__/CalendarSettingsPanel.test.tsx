import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarSettingsPanel } from '../CalendarSettingsPanel';
import type { CalendarConfig } from '@/types/calendar';

const config = (): CalendarConfig => ({
  clock: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
  weekDays: [{ name: 'Sul' }, { name: 'Mol' }, { name: 'Zor' }],
  months: [
    { name: 'Deepwinter', days: 30 },
    { name: 'Thaw', days: 28 },
  ],
  seasons: [
    { name: 'Winter', startDay: 0, endDay: 57, sunriseHour: 8, sunsetHour: 16 },
  ],
  moons: [{ name: 'Selûne', color: '#E8E8F0', phaseOffset: 0, period: 30 }],
  namedYears: [],
  eras: [{ name: 'Dale Reckoning', abbreviation: 'DR', startYear: 1 }],
  yearOffset: 1492,
  yearStartWeekdayOffset: 1,
  weekStartsOn: 0,
  mechanics: {
    hoursPerLongRest: 8,
    minutesPerShortRest: 60,
    secondsPerRound: 6,
  },
});

afterEach(cleanup);

function setup(cfg: CalendarConfig = config()) {
  const onSave = vi.fn();
  const utils = render(<CalendarSettingsPanel config={cfg} onSave={onSave} />);
  return { onSave, ...utils };
}

const section = (name: string) =>
  screen.getByRole('heading', { level: 2, name }).closest('section')!;

describe('CalendarSettingsPanel', () => {
  it('groups settings into seven sections without cards', () => {
    const { container } = setup();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
    ).toEqual([
      'Clock',
      'Week days',
      'Months',
      'Seasons',
      'Moons',
      'Eras',
      'Year and mechanics',
    ]);
    expect(container.querySelector('.bg-surface-raised')).toBeNull();
    expect(container.querySelector('.bg-surface-secondary')).toBeNull();
    expect(container.querySelector('[class*="accent-"]')).toBeNull();
    expect(container.querySelectorAll('ul.divide-y')).toHaveLength(5);
  });

  it.each([
    'Hours per day',
    'Minutes per hour',
    'Seconds per minute',
    'Day 1 name',
    'Day 3 name',
    'Month 1 name',
    'Month 2 name',
    'Days in Deepwinter',
    'Days in Thaw',
    'Name',
    'Start day',
    'End day',
    'Sunrise (hour)',
    'Sunset (hour)',
    'Period',
    'Offset',
    'Abbreviation',
    'Start year',
    'End year',
    'Starting year',
    'Long rest (hours)',
    'Short rest (minutes)',
    'Round (seconds)',
  ])('labels the %s field', name => {
    setup();
    expect(
      screen.getAllByRole('textbox', { name }).length
    ).toBeGreaterThanOrEqual(1);
  });

  it('labels the selects and shows helper texts', () => {
    setup();
    expect(
      screen.getByRole('combobox', { name: 'Year starts on' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Week starts on' })
    ).toBeInTheDocument();
    [
      "The year number at the calendar's first day.",
      "Weekday of the calendar's first day.",
      'The first column in month view',
      'Days per cycle',
      'First new moon day',
    ].forEach(text => expect(screen.getByText(text)).toBeInTheDocument());
  });

  it.each([
    ['Remove Sul'],
    ['Remove Deepwinter'],
    ['Remove Winter'],
    ['Remove Selûne'],
    ['Remove Dale Reckoning'],
  ])('names the %s button and colours its icon', name => {
    setup();
    const button = screen.getByRole('button', { name });
    const icon = button.querySelector('svg');
    expect(icon).toHaveClass('text-blood-text');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('falls back to the row number when a name is blank', async () => {
    setup();
    const user = userEvent.setup();
    await user.clear(screen.getByRole('textbox', { name: 'Day 2 name' }));
    expect(
      screen.getByRole('button', { name: 'Remove day 2' })
    ).toBeInTheDocument();

    await user.clear(screen.getByRole('textbox', { name: 'Month 1 name' }));
    expect(
      screen.getByRole('button', { name: 'Remove month 1' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Days in month 1' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Days in Deepwinter' })
    ).toBeNull();

    for (const [heading, removeName] of [
      ['Seasons', 'Remove season 1'],
      ['Moons', 'Remove moon 1'],
      ['Eras', 'Remove era 1'],
    ]) {
      await user.clear(
        within(section(heading)).getByRole('textbox', { name: 'Name' })
      );
      expect(
        screen.getByRole('button', { name: removeName })
      ).toBeInTheDocument();
    }
  });

  it('keeps one week day and one month', () => {
    setup({
      ...config(),
      weekDays: [{ name: 'Sul' }],
      months: [{ name: 'Deepwinter', days: 30 }],
    });
    expect(screen.getByRole('button', { name: 'Remove Sul' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Remove Deepwinter' })
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Sul' }));
    expect(
      screen.getByRole('textbox', { name: 'Day 1 name' })
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Remove Winter' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove Selûne' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Remove Dale Reckoning' })
    ).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Winter' }));
    expect(screen.queryByRole('button', { name: 'Remove Winter' })).toBeNull();
  });

  it('adds rows with sentence-case defaults', async () => {
    const { onSave } = setup();
    const user = userEvent.setup();
    for (const name of [
      'Add day',
      'Add month',
      'Add season',
      'Add moon',
      'Add era',
    ]) {
      await user.click(screen.getByRole('button', { name }));
    }
    expect(screen.getByRole('textbox', { name: 'Day 4 name' })).toHaveValue(
      'New day'
    );
    expect(screen.getByRole('textbox', { name: 'Month 3 name' })).toHaveValue(
      'New month'
    );
    for (const name of [
      'Remove New season',
      'Remove New moon',
      'Remove New era',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const saved = onSave.mock.calls[0][0] as CalendarConfig;
    expect(saved.weekDays[3].name).toBe('New day');
    expect(saved.months[2]).toEqual({ name: 'New month', days: 30 });
    expect(saved.seasons[1].name).toBe('New season');
    expect(saved.moons[1]).toEqual({
      name: 'New moon',
      color: '#C0C0C0',
      phaseOffset: 0,
      period: 28,
    });
    expect(saved.eras[1]).toEqual({
      name: 'New era',
      abbreviation: 'NE',
      startYear: 1,
    });
  });

  it('turns Discard changes on only once the draft changes', async () => {
    const { onSave } = setup();
    const user = userEvent.setup();
    const discard = screen.getByRole('button', { name: 'Discard changes' });
    expect(discard).toBeDisabled();

    const hours = screen.getByRole('textbox', { name: 'Hours per day' });
    await user.type(hours, '2');
    expect(hours).toHaveValue('242');
    expect(discard).toBeEnabled();

    await user.click(discard);
    expect(screen.getByRole('textbox', { name: 'Hours per day' })).toHaveValue(
      '24'
    );
    expect(discard).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Discard changes brings back a removed row and the saved weekday', async () => {
    const { onSave } = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Remove Thaw' }));
    await user.click(screen.getByRole('combobox', { name: 'Year starts on' }));
    await user.click(screen.getByRole('option', { name: 'Zor' }));
    expect(screen.queryByRole('button', { name: 'Remove Thaw' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByRole('textbox', { name: 'Month 2 name' })).toHaveValue(
      'Thaw'
    );
    expect(screen.getByRole('textbox', { name: 'Days in Thaw' })).toHaveValue(
      '28'
    );
    expect(
      screen.getByRole('combobox', { name: 'Year starts on' })
    ).toHaveTextContent('Mol');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('enables Discard changes after adding a day or choosing a weekday', async () => {
    const user = userEvent.setup();
    const first = setup();
    await user.click(screen.getByRole('button', { name: 'Add day' }));
    expect(
      screen.getByRole('button', { name: 'Discard changes' })
    ).toBeEnabled();
    first.unmount();

    setup();
    await user.click(screen.getByRole('combobox', { name: 'Year starts on' }));
    await user.click(screen.getByRole('option', { name: 'Sul' }));
    expect(
      screen.getByRole('button', { name: 'Discard changes' })
    ).toBeEnabled();
  });

  it('saves the draft', async () => {
    const { onSave } = setup();
    const user = userEvent.setup();
    const year = screen.getByRole('textbox', { name: 'Starting year' });
    await user.clear(year);
    await user.type(year, '1493');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ ...config(), yearOffset: 1493 });
  });

  it('lists the week days in Year starts on', async () => {
    const { onSave } = setup();
    const user = userEvent.setup();
    const select = screen.getByRole('combobox', { name: 'Year starts on' });
    expect(select).toHaveTextContent('Mol');
    await user.click(select);
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual([
      'Sul',
      'Mol',
      'Zor',
    ]);
    expect(screen.getByRole('option', { name: 'Mol' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await user.click(screen.getByRole('option', { name: 'Zor' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave.mock.calls[0][0].yearStartWeekdayOffset).toBe(2);
  });

  it('shows the weekday the calendar uses after days are removed', async () => {
    const { onSave } = setup({ ...config(), yearStartWeekdayOffset: 2 });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Remove Zor' }));
    const select = screen.getByRole('combobox', { name: 'Year starts on' });
    expect(select).toHaveTextContent('Sul');
    await user.click(select);
    expect(screen.getByRole('option', { name: 'Sul' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave.mock.calls[0][0].yearStartWeekdayOffset).toBe(2);
  });

  it('caps sunrise and sunset at the last hour of the day', async () => {
    setup();
    const user = userEvent.setup();
    const sunrise = screen.getByRole('textbox', { name: 'Sunrise (hour)' });
    await user.clear(sunrise);
    await user.type(sunrise, '30');
    await user.tab();
    expect(sunrise).toHaveValue('23');

    const hours = screen.getByRole('textbox', { name: 'Hours per day' });
    await user.clear(hours);
    await user.type(hours, '20');
    const sunset = screen.getByRole('textbox', { name: 'Sunset (hour)' });
    await user.clear(sunset);
    await user.type(sunset, '30');
    await user.tab();
    expect(sunset).toHaveValue('19');
  });

  it('uses the new button names', () => {
    const { container } = setup();
    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save).toHaveAttribute('data-variant', 'primary');
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(
      1
    );
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(screen.queryByText('Save Changes')).toBeNull();
    expect(screen.queryByText('Year & Mechanics')).toBeNull();
    expect(screen.queryByText(/Weekday index/)).toBeNull();
  });
});
