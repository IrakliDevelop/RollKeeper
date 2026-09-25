import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { CreatureAbilities } from '../CreatureAbilities';
import type { EncounterEntity, MonsterStatBlock } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

afterEach(() => cleanup());

function makeStatBlock(
  overrides: Partial<MonsterStatBlock> = {}
): MonsterStatBlock {
  return {
    str: 16,
    dex: 14,
    con: 12,
    int: 8,
    wis: 15,
    cha: 10,
    saves: 'DEX +5',
    saveProficiencies: undefined,
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
    initiative: null,
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
  overrides: Partial<ComponentProps<typeof CreatureAbilities>> = {}
) {
  return {
    entity: makeEntity({ monsterStatBlock: makeStatBlock() }),
    actions: makeActions(),
    editing: false,
    ...overrides,
  };
}

describe('CreatureAbilities', () => {
  it('returns null without a monster stat block', () => {
    const { container } = render(
      <CreatureAbilities {...baseProps({ entity: makeEntity() })} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('CreatureAbilities read-only', () => {
  it('shows abbreviation, score, and modifier for each ability', () => {
    render(<CreatureAbilities {...baseProps()} />);
    expect(screen.getByText('STR')).toBeInTheDocument();
    expect(screen.getByText('16')).toBeInTheDocument();
    // STR mod +3 shown alongside its (unproficient, so equal) save value.
    expect(screen.getAllByText('+3')).toHaveLength(2);
  });

  it('shows a save-string override verbatim (DEX proficient +5)', () => {
    render(<CreatureAbilities {...baseProps()} />);
    expect(screen.getByText('+5')).toBeInTheDocument();
  });

  it('calculates a save from mod + PB when proficiencies are explicit with no override', () => {
    render(
      <CreatureAbilities
        {...baseProps({
          entity: makeEntity({
            proficiencyBonus: 3,
            monsterStatBlock: makeStatBlock({
              saves: '',
              saveProficiencies: ['wis'],
              wis: 15,
            }),
          }),
        })}
      />
    );
    // WIS mod +2, PB +3 => +5
    expect(screen.getByText('+5')).toBeInTheDocument();
  });

  it('renders no editable inputs or controls', () => {
    render(<CreatureAbilities {...baseProps()} />);
    expect(screen.queryByLabelText('STR score')).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('DEX save proficiency')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Reset')).not.toBeInTheDocument();
  });
});

describe('CreatureAbilities editing', () => {
  it('patches the score via a NumberField', () => {
    const actions = makeActions();
    render(<CreatureAbilities {...baseProps({ actions, editing: true })} />);
    fireEvent.change(screen.getByLabelText('STR score'), {
      target: { value: '18' },
    });
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      monsterStatBlock: expect.objectContaining({ str: 18 }),
    });
  });

  it('toggles save proficiency on via the SAVE button', () => {
    const actions = makeActions();
    render(
      <CreatureAbilities
        {...baseProps({
          actions,
          editing: true,
          entity: makeEntity({
            monsterStatBlock: makeStatBlock({
              saves: '',
              saveProficiencies: [],
            }),
          }),
        })}
      />
    );
    const button = screen.getByLabelText('STR save proficiency');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      monsterStatBlock: expect.objectContaining({
        saveProficiencies: ['str'],
      }),
    });
  });

  it('toggles save proficiency off and strips any override via the SAVE button', () => {
    const actions = makeActions();
    render(
      <CreatureAbilities
        {...baseProps({
          actions,
          editing: true,
          entity: makeEntity({
            monsterStatBlock: makeStatBlock({
              saves: 'DEX +5',
              saveProficiencies: ['dex'],
            }),
          }),
        })}
      />
    );
    const button = screen.getByLabelText('DEX save proficiency');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      monsterStatBlock: expect.objectContaining({
        saveProficiencies: [],
        saves: '',
      }),
    });
  });

  it('shows a Reset link for an overridden save and patches it away', () => {
    const actions = makeActions();
    render(
      <CreatureAbilities
        {...baseProps({
          actions,
          editing: true,
          entity: makeEntity({
            monsterStatBlock: makeStatBlock({
              saves: 'DEX +5',
              saveProficiencies: ['dex'],
            }),
          }),
        })}
      />
    );
    const resetButton = screen.getByLabelText('Reset DEX saving throw');
    fireEvent.click(resetButton);
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      monsterStatBlock: expect.objectContaining({
        saveProficiencies: ['dex'],
        saves: '',
      }),
    });
  });

  it('does not show a Reset link when there is no override', () => {
    render(
      <CreatureAbilities
        {...baseProps({
          editing: true,
          entity: makeEntity({
            monsterStatBlock: makeStatBlock({
              saves: '',
              saveProficiencies: ['dex'],
            }),
          }),
        })}
      />
    );
    expect(screen.queryByText('Reset')).not.toBeInTheDocument();
  });
});
