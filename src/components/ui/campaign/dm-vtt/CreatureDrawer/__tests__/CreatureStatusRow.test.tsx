import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { CreatureStatusRow } from '../CreatureStatusRow';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeEntity(overrides: Partial<EncounterEntity> = {}): EncounterEntity {
  return {
    id: 'e1',
    type: 'npc',
    name: 'Goblin Boss',
    initiative: null,
    initiativeModifier: 2,
    currentHp: 10,
    maxHp: 20,
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

function baseProps(
  overrides: Partial<ComponentProps<typeof CreatureStatusRow>> = {}
) {
  return {
    entity: makeEntity(),
    actions: makeActions(),
    editing: false,
    ...overrides,
  };
}

describe('CreatureStatusRow', () => {
  it('shows no concentration banner when not concentrating', () => {
    render(<CreatureStatusRow {...baseProps()} />);
    expect(screen.queryByText(/concentrating on/i)).not.toBeInTheDocument();
  });

  it('shows a read-only concentration banner with the CON save hint and value', () => {
    render(
      <CreatureStatusRow
        {...baseProps({
          entity: makeEntity({
            concentrationSpell: 'Hold Person',
            proficiencyBonus: 3,
            monsterStatBlock: {
              str: 10,
              dex: 10,
              con: 14,
              int: 10,
              wis: 10,
              cha: 10,
              saveProficiencies: ['con'],
            } as never,
          }),
        })}
      />
    );
    const banner = screen.getByRole('status', { name: /concentration/i });
    expect(banner).toHaveTextContent('Concentrating on Hold Person');
    expect(banner).toHaveTextContent(
      'On damage: CON save, DC 10 or half the damage, whichever is higher.'
    );
    expect(banner).toHaveTextContent('CON save +5');
    expect(
      screen.queryByRole('button', { name: /roll/i })
    ).not.toBeInTheDocument();
  });

  it('uses a CON save override from the stat block saves string', () => {
    render(
      <CreatureStatusRow
        {...baseProps({
          entity: makeEntity({
            concentrationSpell: 'Bless',
            monsterStatBlock: {
              str: 10,
              dex: 10,
              con: 8,
              int: 10,
              wis: 10,
              cha: 10,
              saves: 'CON +7',
            } as never,
          }),
        })}
      />
    );
    expect(screen.getByText('CON save +7')).toBeInTheDocument();
  });

  it('omits the CON save value without a stat block', () => {
    render(
      <CreatureStatusRow
        {...baseProps({ entity: makeEntity({ concentrationSpell: 'Bless' }) })}
      />
    );
    expect(screen.getByText('Concentrating on Bless')).toBeInTheDocument();
    expect(screen.queryByText(/CON save [+-]/)).not.toBeInTheDocument();
  });

  it('renders the concentration input for a non-player', () => {
    render(<CreatureStatusRow {...baseProps()} />);
    expect(screen.getByPlaceholderText('None')).toBeInTheDocument();
  });

  it('shows death saves at 0 HP with death saves present', () => {
    render(
      <CreatureStatusRow
        {...baseProps({
          entity: makeEntity({
            currentHp: 0,
            deathSaves: { successes: 1, failures: 0, isStabilized: false },
          }),
        })}
      />
    );
    expect(screen.getByLabelText('Death save success 1')).toBeInTheDocument();
  });

  it('does not show death saves above 0 HP', () => {
    render(<CreatureStatusRow {...baseProps()} />);
    expect(
      screen.queryByLabelText('Death save success 1')
    ).not.toBeInTheDocument();
  });

  it('shows Spend Hit Die and heals + updates hit dice on click', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const actions = makeActions();
    render(
      <CreatureStatusRow
        {...baseProps({
          actions,
          entity: makeEntity({
            currentHp: 10,
            maxHp: 20,
            hitDice: { current: 2, max: 4, dieType: 'd8' },
          }),
        })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /spend hit die/i }));
    expect(actions.onHeal).toHaveBeenCalledWith('e1', 5);
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      hitDice: { current: 1, max: 4, dieType: 'd8' },
    });
  });

  it('hides Spend Hit Die when no hit dice remain', () => {
    render(
      <CreatureStatusRow
        {...baseProps({
          entity: makeEntity({
            hitDice: { current: 0, max: 4, dieType: 'd8' },
          }),
        })}
      />
    );
    expect(
      screen.queryByRole('button', { name: /spend hit die/i })
    ).not.toBeInTheDocument();
  });
});
