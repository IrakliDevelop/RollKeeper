import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { HeaderControls } from '../HeaderControls';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '../../types';

function makeEntity(overrides: Partial<EncounterEntity> = {}): EncounterEntity {
  return {
    id: 'e1',
    type: 'monster',
    name: 'Goblin Boss',
    initiative: null,
    initiativeModifier: 2,
    currentHp: 10,
    maxHp: 10,
    tempHp: 0,
    armorClass: 15,
    conditions: [],
    ...overrides,
  };
}

function makeActions(): EntityActions {
  return {
    onUpdate: vi.fn(),
    onRemove: vi.fn(),
    onDamage: vi.fn(),
    onHeal: vi.fn(),
    onAddTempHp: vi.fn(),
    onSetMaxHp: vi.fn(),
    onAddCondition: vi.fn(),
    onRemoveCondition: vi.fn(),
    onSetConditionRounds: vi.fn(),
    onUseAbility: vi.fn(),
    onRestoreAbility: vi.fn(),
    onSpendResource: vi.fn(),
    onRestoreResource: vi.fn(),
    onUseLegendaryAction: vi.fn(),
    onResetLegendaryActions: vi.fn(),
    onSetConcentration: vi.fn(),
    onUseLairAction: vi.fn(),
    onSetInitiative: vi.fn(),
    onLongRest: vi.fn(),
    onShortRest: vi.fn(),
  };
}

afterEach(() => cleanup());

describe('HeaderControls players-see text', () => {
  it('renders the alias when hidden with an alias, plus exact HP suffix', () => {
    render(
      <HeaderControls
        entity={makeEntity({
          isHidden: true,
          playerAlias: 'Mystery Foe',
          hpVisibleToPlayers: true,
        })}
        actions={makeActions()}
      />
    );
    const preview = screen.getByText(/Players see:/).closest('span');
    expect(preview).toHaveTextContent('Players see: Mystery Foe · exact HP');
  });

  it('falls back to Enemy when hidden with no alias, and omits the HP suffix', () => {
    render(
      <HeaderControls
        entity={makeEntity({ isHidden: true })}
        actions={makeActions()}
      />
    );
    const preview = screen.getByText(/Players see:/).closest('span');
    expect(preview).toHaveTextContent('Players see: Enemy');
    expect(preview).not.toHaveTextContent('exact HP');
  });
});
