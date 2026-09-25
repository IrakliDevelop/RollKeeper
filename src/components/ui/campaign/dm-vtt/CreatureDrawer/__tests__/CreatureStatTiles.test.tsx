import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { CreatureStatTiles } from '../CreatureStatTiles';
import type { EncounterEntity, MonsterStatBlock } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

afterEach(() => cleanup());

function makeStatBlock(
  overrides: Partial<MonsterStatBlock> = {}
): MonsterStatBlock {
  return {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    saves: '',
    skills: '',
    speed: '30 ft.',
    resistances: '',
    immunities: '',
    vulnerabilities: '',
    conditionImmunities: [],
    senses: '',
    passivePerception: 13,
    traits: [],
    actions: [],
    reactions: [],
    bonusActions: [],
    lairActions: [],
    cr: '1',
    type: 'humanoid',
    size: 'Small',
    languages: '',
    alignment: 'neutral evil',
    hpFormula: '2d6',
    ...overrides,
  };
}

function makeEntity(overrides: Partial<EncounterEntity> = {}): EncounterEntity {
  return {
    id: 'e1',
    type: 'monster',
    name: 'Goblin Boss',
    initiative: 14,
    initiativeModifier: 2,
    currentHp: 10,
    maxHp: 20,
    tempHp: 0,
    armorClass: 15,
    proficiencyBonus: 3,
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
  overrides: Partial<ComponentProps<typeof CreatureStatTiles>> = {}
) {
  return {
    entity: makeEntity({ monsterStatBlock: makeStatBlock() }),
    actions: makeActions(),
    editing: false,
    ...overrides,
  };
}

describe('CreatureStatTiles read-only', () => {
  it('shows effective AC with a temp-AC subline', () => {
    render(
      <CreatureStatTiles
        {...baseProps({
          entity: makeEntity({
            armorClass: 15,
            tempAc: 2,
            monsterStatBlock: makeStatBlock(),
          }),
        })}
      />
    );
    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.getByText('15 + 2')).toBeInTheDocument();
  });

  it('shows initiative value with signed modifier subline', () => {
    render(<CreatureStatTiles {...baseProps()} />);
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('INIT +2')).toBeInTheDocument();
  });

  it('shows speed from the stat block', () => {
    render(<CreatureStatTiles {...baseProps()} />);
    expect(screen.getByText('30 ft.')).toBeInTheDocument();
  });

  it('shows signed PB and passive perception', () => {
    render(<CreatureStatTiles {...baseProps()} />);
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByText(/13/)).toBeInTheDocument();
  });

  it('renders no editable inputs in Play', () => {
    render(<CreatureStatTiles {...baseProps()} />);
    expect(screen.queryByLabelText('Armor class')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Speed')).not.toBeInTheDocument();
  });
});

describe('CreatureStatTiles editing', () => {
  it('patches armor class and temp AC', () => {
    const actions = makeActions();
    render(<CreatureStatTiles {...baseProps({ actions, editing: true })} />);
    fireEvent.change(screen.getByLabelText('Armor class'), {
      target: { value: '16' },
    });
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', { armorClass: 16 });

    fireEvent.change(screen.getByLabelText('Temporary AC bonus'), {
      target: { value: '3' },
    });
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', { tempAc: 3 });
  });

  it('patches initiative modifier', () => {
    const actions = makeActions();
    render(<CreatureStatTiles {...baseProps({ actions, editing: true })} />);
    fireEvent.change(screen.getByLabelText('Initiative Mod'), {
      target: { value: '5' },
    });
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      initiativeModifier: 5,
    });
  });

  it('patches speed on blur', () => {
    const actions = makeActions();
    render(<CreatureStatTiles {...baseProps({ actions, editing: true })} />);
    const speedInput = screen.getByLabelText('Speed');
    fireEvent.change(speedInput, { target: { value: '40 ft.' } });
    fireEvent.blur(speedInput);
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      monsterStatBlock: expect.objectContaining({ speed: '40 ft.' }),
    });
  });

  it('skips the speed patch when unchanged', () => {
    const actions = makeActions();
    render(
      <CreatureStatTiles
        {...baseProps({
          actions,
          editing: true,
          entity: makeEntity({
            monsterStatBlock: makeStatBlock({ speed: '30 ft.' }),
          }),
        })}
      />
    );
    fireEvent.blur(screen.getByLabelText('Speed'));
    expect(actions.onUpdate).not.toHaveBeenCalled();
  });

  it('resyncs the speed field when the stat block speed changes elsewhere', () => {
    const p = baseProps({
      editing: true,
      entity: makeEntity({
        monsterStatBlock: makeStatBlock({ speed: '30 ft.' }),
      }),
    });
    const { rerender } = render(<CreatureStatTiles {...p} />);
    rerender(
      <CreatureStatTiles
        {...p}
        entity={makeEntity({
          monsterStatBlock: makeStatBlock({ speed: '40 ft., fly 60 ft.' }),
        })}
      />
    );
    expect(screen.getByLabelText('Speed')).toHaveValue('40 ft., fly 60 ft.');
  });

  it('patches proficiency bonus', () => {
    const actions = makeActions();
    render(<CreatureStatTiles {...baseProps({ actions, editing: true })} />);
    fireEvent.change(screen.getByLabelText('Proficiency Bonus'), {
      target: { value: '4' },
    });
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      proficiencyBonus: 4,
    });
  });
});
