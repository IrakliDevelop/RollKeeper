// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DetailCombatInfo } from '@/components/ui/encounter/combat-screen/detail/DetailCombatInfo';
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

const statBlock: MonsterStatBlock = {
  str: 16,
  dex: 12,
  con: 14,
  int: 11,
  wis: 13,
  cha: 10,
  saves: 'Str +5, Con +4',
  skills: 'Athletics +5, Perception +3',
  speed: '30 ft.',
  resistances: 'fire',
  immunities: 'poison',
  vulnerabilities: 'cold',
  conditionImmunities: ['Charmed', 'Frightened'],
  senses: 'Darkvision 60 ft.',
  passivePerception: 13,
  traits: [],
  actions: [],
  bonusActions: [],
  reactions: [],
  lairActions: [],
  cr: '3',
  type: 'humanoid',
  size: 'Medium',
  languages: 'Common',
  alignment: 'Lawful Evil',
  hpFormula: '8d8+16',
};

const monsterEntity: EncounterEntity = {
  id: 'monster-1',
  type: 'monster',
  name: 'Goblin Boss',
  initiative: 15,
  initiativeModifier: 1,
  proficiencyBonus: 2,
  currentHp: 21,
  maxHp: 21,
  tempHp: 0,
  armorClass: 17,
  conditions: [],
  monsterStatBlock: statBlock,
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
};

describe('DetailCombatInfo — field inventory', () => {
  it('monster with a stat block: renders all fields including Initiative and Proficiency Bonus', () => {
    const actions = makeActions();
    render(<DetailCombatInfo entity={monsterEntity} actions={actions} />);

    expect(screen.getByText('Combat Details')).toBeInTheDocument();
    expect(screen.getByLabelText('Initiative')).toHaveValue(15);
    expect(screen.getByLabelText('Proficiency Bonus')).toHaveValue(2);
    expect(screen.getByLabelText('Speed')).toHaveValue('30 ft.');
    expect(screen.getByLabelText('Saving Throws')).toHaveValue(
      'Str +5, Con +4'
    );
    expect(screen.getByLabelText('Skills')).toHaveValue(
      'Athletics +5, Perception +3'
    );
    expect(screen.getByLabelText('Resistances')).toHaveValue('fire');
    expect(screen.getByLabelText('Immunities')).toHaveValue('poison');
    expect(screen.getByLabelText('Vulnerabilities')).toHaveValue('cold');
    expect(screen.getByLabelText('Condition Immunities')).toHaveValue(
      'Charmed, Frightened'
    );
    expect(screen.getByLabelText('Senses')).toHaveValue('Darkvision 60 ft.');
    expect(screen.getByLabelText('Languages')).toHaveValue('Common');
    expect(screen.getByLabelText('Passive Perception')).toHaveValue(13);
  });

  it('editing Initiative to a non-empty value commits via onSetInitiative (keeps turn order sorted)', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DetailCombatInfo entity={monsterEntity} actions={actions} />);

    const input = screen.getByLabelText('Initiative');
    await user.clear(input);
    await user.type(input, '22');
    await user.tab();

    expect(actions.onSetInitiative).toHaveBeenCalledWith('monster-1', 22);
    expect(actions.onUpdate).not.toHaveBeenCalledWith(
      'monster-1',
      expect.objectContaining({ initiative: expect.anything() })
    );
  });

  it('clearing Initiative to empty commits null via onUpdate (onSetInitiative takes a number)', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DetailCombatInfo entity={monsterEntity} actions={actions} />);

    const input = screen.getByLabelText('Initiative');
    await user.clear(input);
    await user.tab();

    expect(actions.onUpdate).toHaveBeenCalledWith('monster-1', {
      initiative: null,
    });
    expect(actions.onSetInitiative).not.toHaveBeenCalled();
  });

  it('editing Proficiency Bonus commits via onUpdate on blur', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DetailCombatInfo entity={monsterEntity} actions={actions} />);

    const input = screen.getByLabelText('Proficiency Bonus');
    await user.clear(input);
    await user.type(input, '4');
    await user.tab();

    expect(actions.onUpdate).toHaveBeenCalledWith('monster-1', {
      proficiencyBonus: 4,
    });
  });

  it('editing a stat-block field (Skills) patches monsterStatBlock via onUpdate', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DetailCombatInfo entity={monsterEntity} actions={actions} />);

    const input = screen.getByLabelText('Skills');
    await user.clear(input);
    await user.type(input, 'Stealth +6');
    await user.tab();

    expect(actions.onUpdate).toHaveBeenCalledWith(
      'monster-1',
      expect.objectContaining({
        monsterStatBlock: expect.objectContaining({ skills: 'Stealth +6' }),
      })
    );
  });

  it('editing Condition Immunities splits the comma-separated input into an array', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DetailCombatInfo entity={monsterEntity} actions={actions} />);

    const input = screen.getByLabelText('Condition Immunities');
    await user.clear(input);
    await user.type(input, 'Poisoned,  Stunned ,Charmed');
    await user.tab();

    expect(actions.onUpdate).toHaveBeenCalledWith(
      'monster-1',
      expect.objectContaining({
        monsterStatBlock: expect.objectContaining({
          conditionImmunities: ['Poisoned', 'Stunned', 'Charmed'],
        }),
      })
    );
  });

  it('editing Passive Perception parses as a number', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DetailCombatInfo entity={monsterEntity} actions={actions} />);

    const input = screen.getByLabelText('Passive Perception');
    await user.clear(input);
    await user.type(input, '17');
    await user.tab();

    expect(actions.onUpdate).toHaveBeenCalledWith(
      'monster-1',
      expect.objectContaining({
        monsterStatBlock: expect.objectContaining({ passivePerception: 17 }),
      })
    );
  });
});

describe('DetailCombatInfo — player entities stay read-only', () => {
  it('player with initiative only: Initiative renders as static text, Proficiency Bonus is hidden', () => {
    const actions = makeActions();
    render(<DetailCombatInfo entity={playerEntity} actions={actions} />);

    expect(screen.getByText('Initiative')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.queryByLabelText('Initiative')).not.toBeInTheDocument();
    expect(screen.queryByText('Proficiency Bonus')).not.toBeInTheDocument();
  });

  it('player entity with a synced stat block never renders editable inputs', () => {
    const actions = makeActions();
    const syncedPlayer: EncounterEntity = {
      ...playerEntity,
      monsterStatBlock: statBlock,
    };
    render(<DetailCombatInfo entity={syncedPlayer} actions={actions} />);

    expect(screen.getByText('Speed')).toBeInTheDocument();
    expect(screen.getByText('30 ft.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Speed')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Skills')).not.toBeInTheDocument();
  });
});

describe('DetailCombatInfo — hidden when there is nothing to show', () => {
  it('renders nothing for a bare entity with no combat data', () => {
    const actions = makeActions();
    const bareEntity: EncounterEntity = {
      id: 'bare-1',
      type: 'monster',
      name: 'Mystery',
      initiative: null,
      initiativeModifier: 0,
      currentHp: 1,
      maxHp: 1,
      tempHp: 0,
      armorClass: 10,
      conditions: [],
    };
    const { container } = render(
      <DetailCombatInfo entity={bareEntity} actions={actions} />
    );
    expect(container.firstChild).toBeNull();
  });
});
