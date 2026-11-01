import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { LegendarySection } from '../LegendarySection';
import { LairActionsSection } from '../DetailActions';
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
  it('shows the reason a legendary action cannot be used', () => {
    render(
      <LegendarySection
        entity={makeEntity({
          legendaryActions: {
            maxActions: 3,
            usedActions: 2,
            actions: [
              { id: 'wing', name: 'Wing Attack', cost: 2, description: '' },
            ],
          },
        })}
        actions={makeActions()}
      />
    );
    expect(screen.getByText('Needs 2 actions, 1 left')).toBeVisible();
  });

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

describe('LairActionsSection focus', () => {
  it('keeps focus on the used state when Use becomes a badge', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [used, setUsed] = useState(false);
      const entity = makeEntity({
        type: 'lair',
        lairActions: [
          { id: 'mist', name: 'Mist', description: '', usedThisRound: used },
        ],
      });
      const actions = makeActions({ onUseLairAction: () => setUsed(true) });
      return <LairActionsSection entity={entity} actions={actions} />;
    }
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Use Mist' }));
    expect(screen.getByText('Used this round').parentElement).toHaveFocus();
  });
});
