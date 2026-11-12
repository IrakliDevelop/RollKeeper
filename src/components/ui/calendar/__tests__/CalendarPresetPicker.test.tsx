import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CalendarPresetPicker } from '../CalendarPresetPicker';

afterEach(cleanup);

describe('CalendarPresetPicker', () => {
  it('renders one radio per preset, named by the preset and described by the shared text', () => {
    render(
      <CalendarPresetPicker
        value="default"
        onChange={vi.fn()}
        aria-label="Choose a calendar"
      />
    );

    expect(
      screen.getByRole('radiogroup', { name: 'Choose a calendar' })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);

    const descriptions: [string, string][] = [
      [
        'Default (Simple)',
        '7-day weeks, 12 months of 30 days, 4 seasons, 1 moon',
      ],
      [
        'Harptos (Forgotten Realms)',
        'Faerûn calendar with 10-day tendays, 5 holidays, Selûne moon',
      ],
      [
        'Greyhawk (Oerth)',
        '7-day weeks, 12 months of 28 days, 4 festivals, 2 moons',
      ],
      [
        'Barovia (Ravenloft)',
        '7-day weeks, 12 months of 28 days, 28-day moon cycle',
      ],
    ];
    for (const [name, description] of descriptions) {
      expect(screen.getByRole('radio', { name })).toHaveAccessibleDescription(
        description
      );
    }
    expect(
      screen.getByRole('radio', { name: 'Default (Simple)' })
    ).toBeChecked();
  });

  it('reports the chosen preset id', async () => {
    const onChange = vi.fn();
    render(
      <CalendarPresetPicker
        value="default"
        onChange={onChange}
        aria-label="Choose a calendar"
      />
    );

    await userEvent.click(
      screen.getByRole('radio', { name: 'Greyhawk (Oerth)' })
    );

    expect(onChange).toHaveBeenCalledWith('greyhawk');
  });

  it('names the group by id when labelledBy is passed', () => {
    render(
      <>
        <h2 id="h">Pick</h2>
        <CalendarPresetPicker
          value="default"
          onChange={vi.fn()}
          labelledBy="h"
        />
      </>
    );

    expect(
      screen.getByRole('radiogroup', { name: 'Pick' })
    ).toBeInTheDocument();
  });
});
