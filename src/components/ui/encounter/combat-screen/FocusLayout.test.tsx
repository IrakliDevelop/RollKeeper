// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FocusLayout } from './FocusLayout';
import type { Encounter, EncounterEntity } from '@/types/encounter';
import type { EntityActions } from './types';

vi.mock('./detail/CombatantDetail', () => ({
  CombatantDetail: () => <div>Combatant detail</div>,
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
const encounter: Encounter = {
  id: 'enc-1',
  name: 'Ambush',
  entities: [goblin],
  currentTurn: 0,
  round: 1,
  isActive: false,
  sortOrder: 'initiative',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

function Harness() {
  const [drawerId, setDrawerId] = useState<string | null>(null);
  return (
    <FocusLayout
      encounter={encounter}
      hidePlayerHp={false}
      actions={
        {
          onSetInitiative: vi.fn(),
          onRemoveCondition: vi.fn(),
          onUpdate: vi.fn(),
        } as unknown as EntityActions
      }
      drawerId={drawerId}
      onOpenDrawer={setDrawerId}
      onCloseDrawer={() => setDrawerId(null)}
    />
  );
}

describe('FocusLayout detail dialog', () => {
  it('opens from a named row control and restores focus after Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Goblin details' });
    await user.click(opener);
    expect(
      screen.getByRole('dialog', { name: 'Goblin details' })
    ).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });
});
