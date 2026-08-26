// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeaderStatLine } from '@/components/ui/encounter/combat-screen/detail/HeaderStatLine';
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

const statBlock: MonsterStatBlock = {
  str: 16,
  dex: 12,
  con: 14,
  int: 11,
  wis: 13,
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
  bonusActions: [],
  reactions: [],
  lairActions: [],
  cr: '3',
  type: 'humanoid',
  size: 'Medium',
  languages: 'Common',
  alignment: 'Neutral',
  hpFormula: '6d8+12',
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
  monsterStatBlock: statBlock,
};

describe('HeaderStatLine — non-player editing', () => {
  it('renders Speed, Init, and PB inputs with current values', () => {
    render(<HeaderStatLine entity={monsterEntity} actions={makeActions()} />);

    expect(screen.getByLabelText('Speed')).toHaveValue('30 ft.');
    expect(screen.getByLabelText('Initiative Mod')).toHaveValue('1');
    expect(screen.getByLabelText('Proficiency Bonus')).toHaveValue('2');
  });

  it('editing Speed patches monsterStatBlock.speed on blur', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<HeaderStatLine entity={monsterEntity} actions={actions} />);

    const input = screen.getByLabelText('Speed');
    await user.clear(input);
    await user.type(input, '40 ft.');
    await user.tab();

    expect(actions.onUpdate).toHaveBeenCalledWith(
      'monster-1',
      expect.objectContaining({
        monsterStatBlock: expect.objectContaining({ speed: '40 ft.' }),
      })
    );
  });

  it('editing Init commits initiativeModifier (rolled initiative untouched)', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<HeaderStatLine entity={monsterEntity} actions={actions} />);

    const input = screen.getByLabelText('Initiative Mod');
    await user.clear(input);
    await user.type(input, '7');
    await user.tab();

    expect(actions.onUpdate).toHaveBeenCalledWith('monster-1', {
      initiativeModifier: 7,
    });
    expect(actions.onSetInitiative).not.toHaveBeenCalled();
  });

  it('clearing Init commits 0 on blur (NumberField min-fallback)', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<HeaderStatLine entity={monsterEntity} actions={actions} />);

    const input = screen.getByLabelText('Initiative Mod');
    await user.clear(input);
    await user.tab();

    expect(actions.onUpdate).toHaveBeenCalledWith('monster-1', {
      initiativeModifier: 0,
    });
  });

  it('clearing PB never calls onUpdate (value retained in state)', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<HeaderStatLine entity={monsterEntity} actions={actions} />);

    const input = screen.getByLabelText('Proficiency Bonus');
    await user.clear(input);
    await user.tab();

    expect(actions.onUpdate).not.toHaveBeenCalled();
  });

  it('typing into an unset PB commits proficiencyBonus', async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    const noPb: EncounterEntity = {
      ...monsterEntity,
      proficiencyBonus: undefined,
    };
    render(<HeaderStatLine entity={noPb} actions={actions} />);

    const input = screen.getByLabelText('Proficiency Bonus');
    expect(input).toHaveValue('');
    await user.type(input, '3');

    expect(actions.onUpdate).toHaveBeenCalledWith('monster-1', {
      proficiencyBonus: 3,
    });
  });

  it('without a stat block the Speed line is hidden but Init/PB inputs remain', () => {
    const noSb: EncounterEntity = {
      ...monsterEntity,
      monsterStatBlock: undefined,
    };
    render(<HeaderStatLine entity={noSb} actions={makeActions()} />);

    expect(screen.queryByLabelText('Speed')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Initiative Mod')).toBeInTheDocument();
    expect(screen.getByLabelText('Proficiency Bonus')).toBeInTheDocument();
  });

  it('with a stat block but empty speed, non-players still get an editable Speed input', () => {
    const emptySpeed: EncounterEntity = {
      ...monsterEntity,
      monsterStatBlock: { ...statBlock, speed: '' },
    };
    render(<HeaderStatLine entity={emptySpeed} actions={makeActions()} />);

    expect(screen.getByLabelText('Speed')).toHaveValue('');
  });
});

describe('HeaderStatLine — players are static', () => {
  it('shows static Speed and signed Init, hides PB when unset, renders no inputs', () => {
    render(<HeaderStatLine entity={playerEntity} actions={makeActions()} />);

    expect(screen.getByText('Speed')).toBeInTheDocument();
    expect(screen.getByText('30 ft.')).toBeInTheDocument();
    expect(screen.getByText('Init')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.queryByText('PB')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows signed PB when set', () => {
    const withPb: EncounterEntity = { ...playerEntity, proficiencyBonus: 4 };
    render(<HeaderStatLine entity={withPb} actions={makeActions()} />);

    expect(screen.getByText('PB')).toBeInTheDocument();
    expect(screen.getByText('+4')).toBeInTheDocument();
  });

  it('hides the Speed line for a player with an empty speed', () => {
    const emptySpeed: EncounterEntity = {
      ...playerEntity,
      monsterStatBlock: { ...statBlock, speed: '' },
    };
    render(<HeaderStatLine entity={emptySpeed} actions={makeActions()} />);

    expect(screen.queryByText('Speed')).not.toBeInTheDocument();
  });
});

describe('HeaderStatLine — lair renders nothing', () => {
  it('returns null for lair entities', () => {
    const lair: EncounterEntity = {
      id: 'lair-1',
      type: 'lair',
      name: 'The Lair',
      initiative: 20,
      initiativeModifier: 0,
      currentHp: 0,
      maxHp: 0,
      tempHp: 0,
      armorClass: 0,
      conditions: [],
    };
    const { container } = render(
      <HeaderStatLine entity={lair} actions={makeActions()} />
    );
    expect(container.firstChild).toBeNull();
  });
});
