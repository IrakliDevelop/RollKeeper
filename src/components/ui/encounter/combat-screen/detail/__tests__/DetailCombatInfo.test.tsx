import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DetailCombatInfo } from '../DetailCombatInfo';
import type { EncounterEntity, MonsterStatBlock } from '@/types/encounter';
import type { EntityActions } from '../../types';

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
    saves: 'Str +5',
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
    onSpendResource: vi.fn(() => true),
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

describe('DetailCombatInfo', () => {
  it('defaults to editable rows for a non-player entity with a stat block', () => {
    const entity = makeEntity({ monsterStatBlock: makeStatBlock() });
    render(<DetailCombatInfo entity={entity} actions={makeActions()} />);

    expect(screen.getByLabelText('Saving throws')).toBeInstanceOf(
      HTMLInputElement
    );
  });

  it('renders static, value-hiding rows when readOnly is true', () => {
    const entity = makeEntity({
      monsterStatBlock: makeStatBlock({ saves: 'Str +5', skills: '' }),
    });
    render(
      <DetailCombatInfo entity={entity} actions={makeActions()} readOnly />
    );

    // No inputs at all — every row is static text.
    expect(screen.queryByLabelText('Saving throws')).not.toBeInstanceOf(
      HTMLInputElement
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Str +5')).toBeInTheDocument();
    // Empty values (e.g. blank Skills) are hidden entirely, label included.
    expect(screen.queryByText('Skills')).not.toBeInTheDocument();
  });

  it('commits passive perception on Enter or blur, never per keystroke', async () => {
    const user = userEvent.setup();
    const entity = makeEntity({ monsterStatBlock: makeStatBlock() });
    const actions = makeActions();
    render(<DetailCombatInfo entity={entity} actions={actions} />);

    const field = screen.getByLabelText('Passive perception');
    await user.clear(field);
    await user.type(field, '17');
    expect(actions.onUpdate).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(actions.onUpdate).toHaveBeenCalledTimes(1);
    expect(actions.onUpdate).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({
        monsterStatBlock: expect.objectContaining({ passivePerception: 17 }),
      })
    );

    cleanup();
    const blurActions = makeActions();
    render(<DetailCombatInfo entity={entity} actions={blurActions} />);
    const second = screen.getByLabelText('Passive perception');
    await user.clear(second);
    await user.type(second, '9');
    expect(blurActions.onUpdate).not.toHaveBeenCalled();
    await user.tab();
    expect(blurActions.onUpdate).toHaveBeenCalledTimes(1);
    expect(blurActions.onUpdate).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({
        monsterStatBlock: expect.objectContaining({ passivePerception: 9 }),
      })
    );
  });
});
