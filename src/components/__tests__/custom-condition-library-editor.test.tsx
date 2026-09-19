// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomConditionLibraryEditor } from '@/components/ui/encounter/custom-conditions/CustomConditionLibraryEditor';
import type { CustomCondition } from '@/types/encounter';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const marked: CustomCondition = {
  id: 'cc-marked',
  name: 'Marked',
  description: 'The hunter always knows where you are.',
  icon: 'crosshair',
  kind: 'debuff',
};

function Harness({
  initial,
  onSnapshot,
}: {
  initial: CustomCondition[];
  onSnapshot: (next: CustomCondition[]) => void;
}) {
  const [conditions, setConditions] = useState(initial);
  return (
    <CustomConditionLibraryEditor
      conditions={conditions}
      onChange={next => {
        setConditions(next);
        onSnapshot(next);
      }}
    />
  );
}

describe('CustomConditionLibraryEditor', () => {
  it('tells the DM descriptions are player-facing and shows an empty state', () => {
    render(<Harness initial={[]} onSnapshot={vi.fn()} />);
    expect(screen.getByText(/shown to players/i)).toBeTruthy();
    expect(screen.getByText(/No custom conditions yet/i)).toBeTruthy();
  });

  it('adds a row with debuff defaults and edits its name and description', async () => {
    const user = userEvent.setup();
    const onSnapshot = vi.fn();
    render(<Harness initial={[]} onSnapshot={onSnapshot} />);

    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.type(screen.getByLabelText('Condition name'), 'Hexed');
    await user.type(
      screen.getByLabelText('Condition description'),
      'Disadvantage on Wisdom checks.'
    );

    expect(onSnapshot).toHaveBeenLastCalledWith([
      {
        id: expect.any(String),
        name: 'Hexed',
        description: 'Disadvantage on Wisdom checks.',
        icon: 'trending-down',
        kind: 'debuff',
      },
    ]);
  });

  it('changes icon and kind; a kind change re-defaults an untouched default icon only', async () => {
    const user = userEvent.setup();
    const onSnapshot = vi.fn();
    render(
      <Harness
        initial={[
          marked,
          {
            id: 'cc-plain',
            name: 'Plain',
            description: '',
            icon: 'trending-down',
            kind: 'debuff',
          },
        ]}
        onSnapshot={onSnapshot}
      />
    );

    const markedRow = screen.getByRole('group', { name: 'Marked' });
    fireEvent.click(
      within(markedRow).getByRole('button', {
        name: 'Condition icon: crosshair',
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'target' }));
    expect(onSnapshot.mock.lastCall?.[0][0].icon).toBe('target');

    const plainRow = screen.getByRole('group', { name: 'Plain' });
    await user.click(
      within(plainRow).getByRole('combobox', { name: 'Condition kind' })
    );
    fireEvent.click(await screen.findByRole('option', { name: 'Buff' }));
    expect(onSnapshot.mock.lastCall?.[0][1]).toMatchObject({
      kind: 'buff',
      icon: 'trending-up',
    });
  });

  it('removes a row', async () => {
    const user = userEvent.setup();
    const onSnapshot = vi.fn();
    render(<Harness initial={[marked]} onSnapshot={onSnapshot} />);
    await user.click(screen.getByRole('button', { name: 'Remove Marked' }));
    expect(onSnapshot).toHaveBeenLastCalledWith([]);
  });
});
