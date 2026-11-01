// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FocusLayout } from './FocusLayout';
import type { Encounter, EncounterEntity } from '@/types/encounter';
import type { EntityActions } from './types';

vi.mock('@/components/ui/feedback/confirm-dialog', () => ({
  confirmDialog: vi.fn(async () => true),
}));
afterEach(cleanup);

const goblin: EncounterEntity = {
  id: 'goblin-1',
  type: 'monster',
  name: 'Goblin',
  initiative: 12,
  initiativeModifier: 2,
  currentHp: 7,
  maxHp: 7,
  tempHp: 0,
  armorClass: 15,
  conditions: [],
};
const skeleton: EncounterEntity = {
  ...goblin,
  id: 'skeleton-1',
  name: 'Skeleton',
};
const initial: Encounter = {
  id: 'enc-1',
  name: 'Ambush',
  entities: [goblin, skeleton],
  currentTurn: 0,
  round: 1,
  isActive: false,
  sortOrder: 'initiative',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

function Harness({
  onUpdate = vi.fn(),
}: {
  onUpdate?: EntityActions['onUpdate'];
}) {
  const [encounter, setEncounter] = useState(initial);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const actions = {
    onUpdate,
    onSetInitiative: vi.fn(),
    onRemoveCondition: vi.fn(),
    onRemove: (id: string) =>
      setEncounter(prev => ({
        ...prev,
        entities: prev.entities.filter(entity => entity.id !== id),
      })),
  } as unknown as EntityActions;
  return (
    <>
      <button data-combat-add>Add combatant</button>
      <FocusLayout
        encounter={encounter}
        hidePlayerHp={false}
        actions={actions}
        drawerId={drawerId}
        onOpenDrawer={setDrawerId}
        onCloseDrawer={() => setDrawerId(null)}
      />
    </>
  );
}

describe('FocusLayout edit dialog', () => {
  it('Escape cancels a name edit, keeps the detail dialog open and saves nothing', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<Harness onUpdate={onUpdate} />);
    await user.click(screen.getByRole('button', { name: 'Goblin details' }));
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Combatant name' });
    await user.clear(input);
    await user.type(input, 'Changed');
    await user.keyboard('{Escape}');
    expect(
      screen.getByRole('dialog', { name: 'Goblin details' })
    ).toBeVisible();
    expect(
      within(screen.getByRole('dialog')).getByText('Goblin')
    ).toBeVisible();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('focuses the next row after removing a combatant from the detail dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Goblin details' }));
    await user.click(screen.getByTitle('Remove from combat'));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Skeleton details' })
      ).toHaveFocus()
    );
  });

  it('Escape cancels alias and max HP edits without closing the dialog or saving', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<Harness onUpdate={onUpdate} />);
    await user.click(screen.getByRole('button', { name: 'Goblin details' }));
    await user.click(
      screen.getByTitle('Set alias players see — click to edit')
    );
    await user.type(screen.getByPlaceholderText('Alias…'), 'Hidden');
    await user.keyboard('{Escape}');
    expect(
      screen.getByRole('dialog', { name: 'Goblin details' })
    ).toBeVisible();
    expect(onUpdate).not.toHaveBeenCalled();
    await user.click(screen.getByTitle('Edit max HP'));
    const maxInput = screen.getByDisplayValue('7');
    await user.clear(maxInput);
    await user.type(maxInput, '12');
    await user.keyboard('{Escape}');
    expect(
      screen.getByRole('dialog', { name: 'Goblin details' })
    ).toBeVisible();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
