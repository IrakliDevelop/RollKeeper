import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useEncounterStore } from '@/store/encounterStore';
import type { EncounterEntity } from '@/types/encounter';

import { CombatantDetail } from '../CombatantDetail';
import type { CombatantDetailCapabilities, EntityActions } from '../../types';

vi.mock('@/hooks/useOfficialConditions', () => ({
  useOfficialConditions: () => ({ loading: false, conditions: [] }),
}));
vi.mock('@/hooks/usePaletteSpellEffects', () => ({
  usePaletteSpellEffects: () => ({ loading: false, effects: [] }),
}));

afterEach(cleanup);

function actions(): EntityActions {
  return new Proxy({} as EntityActions, {
    get: (target, key: string) => {
      const record = target as unknown as Record<string, unknown>;
      record[key] ??= vi.fn(() =>
        key === 'onSpendResource' ? true : undefined
      );
      return record[key];
    },
  });
}

const creature: EncounterEntity = {
  id: 'm-goblin',
  type: 'monster',
  name: 'Goblin',
  initiative: 12,
  initiativeModifier: 2,
  currentHp: 7,
  maxHp: 7,
  tempHp: 3,
  armorClass: 15,
  conditions: [{ id: 'c-1', name: 'Prone', rounds: 2, source: 'dm' }],
  concentrationSpell: 'Bless',
  hitDice: { current: 2, max: 2, dieType: 'd6' },
  legendaryActions: { maxActions: 2, usedActions: 0, actions: [] },
  abilities: [
    {
      id: 'a',
      name: 'Bite',
      description: '',
      usageType: 'unlimited',
      usedUses: 0,
    },
  ],
};

const editable: CombatantDetailCapabilities = {
  hp: true,
  tempHp: true,
  maxHp: true,
  armorClass: true,
  conditions: true,
  reaction: true,
  hidden: true,
  creatureConditions: [],
};

const readOnly: CombatantDetailCapabilities = {
  hp: false,
  tempHp: false,
  maxHp: false,
  armorClass: false,
  conditions: false,
  reaction: false,
  hidden: true,
  creatureConditions: [],
  readOnlyNote: 'Read-only adopted PC',
};

describe('CombatantDetail capabilities (R2-4, C3-3)', () => {
  it('offers only the scene-run controls for an editable creature', () => {
    const handlers = actions();
    render(
      <CombatantDetail
        entity={creature}
        actions={handlers}
        capabilities={editable}
      />
    );
    expect(screen.getByRole('button', { name: /Damage/ })).toBeVisible();
    expect(screen.getByLabelText('Armor class')).toBeVisible();
    expect(screen.queryByLabelText('Temporary AC bonus')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull();
    expect(screen.queryByTitle('Remove from combat')).toBeNull();
    expect(screen.queryByTitle('View NPC details')).toBeNull();
    expect(screen.queryByLabelText('Initiative Mod')).toBeNull();
    expect(screen.queryByText(/Spend Hit Die/)).toBeNull();
    expect(screen.queryByPlaceholderText('None')).toBeNull();
    expect(screen.queryByText('Ally')).toBeNull();
    expect(screen.queryByText(/Bite/)).toBeNull();
    expect(screen.getByText(/not available in scene runs/i)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Clear temp HP' }));
    expect(handlers.onUpdate).toHaveBeenCalledWith('m-goblin', { tempHp: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Prone' }));
    expect(handlers.onRemoveCondition).toHaveBeenCalledWith('m-goblin', 'c-1');
    fireEvent.click(screen.getByRole('button', { name: 'Available' }));
    expect(handlers.onUpdate).toHaveBeenCalledWith('m-goblin', {
      hasUsedReaction: true,
    });
  });

  it('renders read-only vitals and conditions without action buttons', () => {
    const handlers = actions();
    render(
      <CombatantDetail
        entity={{ ...creature, type: 'player', playerCharacterId: 'char-b' }}
        actions={handlers}
        capabilities={readOnly}
      />
    );
    expect(screen.getByText('Read-only adopted PC')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Damage/ })).toBeNull();
    expect(screen.queryByLabelText('Armor class')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove Prone' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear temp HP' })).toBeNull();
    expect(screen.queryByPlaceholderText('Custom effect…')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit max HP' })).toBeNull();
    expect(screen.getByText('Prone')).toBeVisible();
  });

  it('uses the creature-conditions override and never searches legacy encounters', () => {
    const selector = vi.spyOn(useEncounterStore.getState().encounters, 'find');
    render(
      <CombatantDetail
        entity={creature}
        actions={actions()}
        capabilities={{
          ...editable,
          creatureConditions: [
            {
              sourceName: 'Ghoul',
              condition: {
                id: 'paralyzed',
                name: 'Paralyzed',
                description: 'Cannot move.',
                icon: 'lock',
                kind: 'debuff',
              },
            },
          ],
        }}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Paralyzed (from Ghoul)' })
    ).toBeVisible();
    expect(selector).not.toHaveBeenCalled();
  });

  it('shows HP as unknown instead of 0/0 while player data is missing (F1)', () => {
    render(
      <CombatantDetail
        entity={{
          ...creature,
          type: 'player',
          currentHp: 0,
          maxHp: 0,
          tempHp: 0,
          armorClass: 0,
        }}
        actions={actions()}
        capabilities={{ ...readOnly, hpUnknown: true }}
      />
    );
    expect(screen.getByText('Waiting for player data')).toBeVisible();
    expect(screen.queryByText('0')).toBeNull();
  });
});
