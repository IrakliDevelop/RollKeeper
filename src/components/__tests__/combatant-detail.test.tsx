// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CombatantDetail } from '@/components/ui/encounter/combat-screen/detail/CombatantDetail';
import type { EncounterEntity, MonsterStatBlock } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

afterEach(cleanup);

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
    onUseLegendaryAction: vi.fn(),
    onResetLegendaryActions: vi.fn(),
    onSetConcentration: vi.fn(),
    onUseLairAction: vi.fn(),
    onSetInitiative: vi.fn(),
    onLongRest: vi.fn(),
  };
}

const baseStatBlock: MonsterStatBlock = {
  str: 30,
  dex: 10,
  con: 29,
  int: 18,
  wis: 15,
  cha: 23,
  saves: 'Dex +6, Con +15',
  skills: 'Perception +16, Stealth +6',
  speed: '40 ft., fly 80 ft.',
  resistances: '',
  immunities: 'Fire',
  vulnerabilities: '',
  conditionImmunities: ['Frightened'],
  senses: 'Blindsight 60 ft.',
  passivePerception: 26,
  traits: [
    {
      name: 'Legendary Resistance',
      text: 'If the dragon fails a save, it can choose to succeed instead.',
    },
  ],
  actions: [{ name: 'Multiattack', text: 'The dragon makes three attacks.' }],
  bonusActions: [],
  reactions: [],
  lairActions: [],
  cr: '24',
  type: 'dragon',
  size: 'Gargantuan',
  languages: 'Common, Draconic',
  alignment: 'Chaotic Evil',
  hpFormula: '21d20+189',
};

const monsterEntity: EncounterEntity = {
  id: 'monster-1',
  type: 'monster',
  name: 'Ancient Dragon',
  initiative: 22,
  initiativeModifier: 4,
  currentHp: 367,
  maxHp: 367,
  tempHp: 0,
  armorClass: 22,
  conditions: [{ id: 'cond1', name: 'Frightened', kind: 'debuff', rounds: 3 }],
  monsterStatBlock: baseStatBlock,
  legendaryActions: {
    maxActions: 3,
    usedActions: 2,
    actions: [
      {
        id: 'detect',
        name: 'Detect',
        cost: 1,
        description: 'Make a Perception check.',
      },
      {
        id: 'wing',
        name: 'Wing Attack',
        cost: 2,
        description: 'Beat wings furiously.',
      },
    ],
  },
  abilities: [
    {
      id: 'breath',
      name: 'Fire Breath',
      description: 'Breathe fire',
      usageType: 'recharge',
      rechargeOn: 5,
      maxUses: 1,
      usedUses: 0,
    },
  ],
};

const playerEntity: EncounterEntity = {
  id: 'player-1',
  type: 'player',
  name: 'Aragorn',
  initiative: 18,
  initiativeModifier: 3,
  currentHp: 40,
  maxHp: 44,
  tempHp: 0,
  armorClass: 16,
  conditions: [],
  monsterStatBlock: {
    ...baseStatBlock,
    str: 18,
    dex: 14,
    con: 16,
    int: 12,
    wis: 14,
    cha: 16,
  },
};

describe('CombatantDetail — monster with full stat block', () => {
  it('renders ability scores, combat info, actions, and effects sections', () => {
    const actions = makeActions();
    render(<CombatantDetail entity={monsterEntity} actions={actions} />);

    expect(screen.getByText('STR')).toBeInTheDocument();
    expect(screen.getByText('Combat Details')).toBeInTheDocument();
    expect(screen.getByText(/legendary actions/i)).toBeInTheDocument();
    expect(screen.getByText(/active effects/i)).toBeInTheDocument();
  });

  it('ability score edit patches monsterStatBlock via onUpdate', () => {
    const actions = makeActions();
    render(<CombatantDetail entity={monsterEntity} actions={actions} />);

    const strInput = screen.getByRole('spinbutton', { name: 'STR' });
    fireEvent.change(strInput, { target: { value: '20' } });

    expect(actions.onUpdate).toHaveBeenCalledWith(
      'monster-1',
      expect.objectContaining({
        monsterStatBlock: expect.objectContaining({ str: 20 }),
      })
    );
  });

  it('debuff palette chip calls onAddCondition with kind debuff', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<CombatantDetail entity={monsterEntity} actions={actions} />);

    await user.click(screen.getByRole('button', { name: 'Blinded' }));

    expect(actions.onAddCondition).toHaveBeenCalledWith('monster-1', {
      name: 'Blinded',
      kind: 'debuff',
      source: 'dm',
    });
  });

  it('buff palette chip calls onAddCondition with kind buff', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<CombatantDetail entity={monsterEntity} actions={actions} />);

    await user.click(screen.getByRole('button', { name: 'Buffs' }));
    await user.click(screen.getByRole('button', { name: 'Bless' }));

    expect(actions.onAddCondition).toHaveBeenCalledWith('monster-1', {
      name: 'Bless',
      kind: 'buff',
      source: 'dm',
    });
  });

  it('rounds stepper + increases rounds via onSetConditionRounds', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<CombatantDetail entity={monsterEntity} actions={actions} />);

    await user.click(
      screen.getByRole('button', { name: 'Frightened increase rounds' })
    );

    expect(actions.onSetConditionRounds).toHaveBeenCalledWith(
      'monster-1',
      'cond1',
      4
    );
  });

  it('legendary Use is disabled when action cost exceeds remaining', () => {
    const actions = makeActions();
    render(<CombatantDetail entity={monsterEntity} actions={actions} />);

    // remaining = 3 - 2 = 1; Wing Attack costs 2 → disabled
    expect(
      screen.getByRole('button', { name: 'Use Wing Attack' })
    ).toBeDisabled();
    // Detect costs 1 → enabled
    expect(
      screen.getByRole('button', { name: 'Use Detect' })
    ).not.toBeDisabled();
  });
});

describe('CombatantDetail — player entity', () => {
  it('shows synced caption and no editable ability score inputs', () => {
    const actions = makeActions();
    render(<CombatantDetail entity={playerEntity} actions={actions} />);

    expect(
      screen.getByText(/synced from character sheet/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('spinbutton', { name: 'STR' })
    ).not.toBeInTheDocument();
  });
});
