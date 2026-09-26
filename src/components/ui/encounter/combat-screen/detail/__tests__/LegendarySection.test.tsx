import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { LegendarySection } from '../LegendarySection';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '../../types';

function makeEntity(overrides: Partial<EncounterEntity> = {}): EncounterEntity {
  return {
    id: 'e1',
    type: 'monster',
    name: 'Ancient Dragon',
    initiative: null,
    initiativeModifier: 4,
    currentHp: 200,
    maxHp: 200,
    tempHp: 0,
    armorClass: 22,
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

describe('LegendarySection description rendering', () => {
  it('renders a badge-span description as text, not literal markup', () => {
    render(
      <LegendarySection
        entity={makeEntity({
          legendaryActions: {
            maxActions: 3,
            usedActions: 0,
            actions: [
              {
                id: 'la-1',
                name: 'Detect',
                cost: 1,
                description:
                  'The dragon makes a <span class="badge">Perception</span> check.',
              },
            ],
          },
        })}
        actions={makeActions()}
      />
    );

    expect(screen.getByText(/Perception/)).toBeInTheDocument();
    expect(screen.queryByText(/<span/)).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('&lt;span');
  });
});
