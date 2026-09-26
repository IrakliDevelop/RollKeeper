import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { DetailHeader } from '../DetailHeader';
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

function makeActions(overrides: Partial<EntityActions> = {}): EntityActions {
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
    ...overrides,
  };
}

afterEach(() => cleanup());

describe('DetailHeader library hint chip', () => {
  it('shows the Library chip for a library-linked NPC', () => {
    render(
      <DetailHeader
        entity={makeEntity({ type: 'npc', npcSourceId: 'npc-1' })}
        actions={makeActions({ onViewNPC: vi.fn() })}
      />
    );
    const chip = screen.getByTitle('Stat edits sync to the NPC library record');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent(
      'Library: stat edits sync to the NPC library record'
    );
    expect(chip).not.toHaveAttribute('aria-label');
  });

  it('does not show the Library chip for a bestiary monster with no npcSourceId', () => {
    render(
      <DetailHeader
        entity={makeEntity({ type: 'monster' })}
        actions={makeActions()}
      />
    );
    expect(
      screen.queryByTitle('Stat edits sync to the NPC library record')
    ).not.toBeInTheDocument();
  });

  it('does not show the Library chip for a player, even with npcSourceId set', () => {
    render(
      <DetailHeader
        entity={makeEntity({ type: 'player', npcSourceId: 'npc-1' })}
        actions={makeActions({ onViewNPC: vi.fn() })}
      />
    );
    expect(
      screen.queryByTitle('Stat edits sync to the NPC library record')
    ).not.toBeInTheDocument();
  });
});
