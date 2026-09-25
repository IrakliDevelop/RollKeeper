import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ActionsTab } from '../tabs/ActionsTab';
import { StatBlockTab } from '../tabs/StatBlockTab';
import { EffectsTab } from '../tabs/EffectsTab';
import { LairTab } from '../tabs/LairTab';
import { useEncounterStore } from '@/store/encounterStore';
import { DEFAULT_COMBAT_CONFIG } from '@/types/encounter';
import type {
  EncounterEntity,
  MonsterAbility,
  MonsterStatBlock,
  StatBlockEntry,
} from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

vi.mock('@/hooks/useOfficialConditions', () => ({
  useOfficialConditions: () => ({ conditions: [], loading: false }),
}));
vi.mock('@/hooks/usePaletteSpellEffects', () => ({
  usePaletteSpellEffects: () => ({ effects: [], loading: false }),
}));

afterEach(() => cleanup());

beforeEach(() => {
  useEncounterStore.setState({
    encounters: [],
    activeEncounterId: null,
    combatConfig: DEFAULT_COMBAT_CONFIG,
  });
});

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
    passivePerception: 10,
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
    onSpendResource: vi.fn(() => true),
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

describe('ActionsTab', () => {
  it('renders the legendary Use button and calls onUseLegendaryAction', async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    const entity = makeEntity({
      legendaryActions: {
        maxActions: 3,
        usedActions: 0,
        actions: [
          {
            id: 'tail',
            name: 'Tail Attack',
            cost: 1,
            description: 'Make a tail attack.',
          },
        ],
      },
    });

    render(<ActionsTab entity={entity} actions={actions} editing={false} />);

    await user.click(screen.getByRole('button', { name: /use tail attack/i }));
    expect(actions.onUseLegendaryAction).toHaveBeenCalledWith('e1', 'tail');
  });

  it('a StatBlockTraits entry use calls onUseAbility', async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    const entry: StatBlockEntry = {
      id: 'breath',
      name: 'Fire Breath',
      text: 'Exhale fire.',
    };
    const ability: MonsterAbility = {
      id: 'breath',
      name: 'Fire Breath',
      description: 'Exhale fire.',
      usageType: 'per-day',
      maxUses: 1,
      usedUses: 0,
    };
    const entity = makeEntity({
      monsterStatBlock: makeStatBlock({ actions: [entry] }),
      abilities: [ability],
    });

    render(<ActionsTab entity={entity} actions={actions} editing={false} />);

    await user.click(
      screen.getByRole('button', { name: /fire breath use 1/i })
    );
    expect(actions.onUseAbility).toHaveBeenCalledWith('e1', 'breath');
  });

  it('renders an empty state when nothing applies', () => {
    render(
      <ActionsTab
        entity={makeEntity()}
        actions={makeActions()}
        editing={false}
      />
    );
    expect(screen.getByText('No actions.')).toBeInTheDocument();
  });
});

describe('StatBlockTab', () => {
  it("calls onOpenEditor when the 'Full stat block editor' button is clicked", async () => {
    const user = userEvent.setup();
    const onOpenEditor = vi.fn();
    const entity = makeEntity({ monsterStatBlock: makeStatBlock() });

    render(
      <StatBlockTab
        entity={entity}
        actions={makeActions()}
        editing={false}
        onOpenEditor={onOpenEditor}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /full stat block editor/i })
    );
    expect(onOpenEditor).toHaveBeenCalledTimes(1);
  });

  it('hides the editor button when onOpenEditor is undefined', () => {
    const entity = makeEntity({ monsterStatBlock: makeStatBlock() });
    render(
      <StatBlockTab entity={entity} actions={makeActions()} editing={false} />
    );
    expect(
      screen.queryByRole('button', { name: /full stat block editor/i })
    ).not.toBeInTheDocument();
  });

  it('shows TokenSettings only when onTokenIdentityChange is supplied', () => {
    const entity = makeEntity({ monsterStatBlock: makeStatBlock() });
    const { rerender } = render(
      <StatBlockTab entity={entity} actions={makeActions()} editing={false} />
    );
    expect(screen.queryByLabelText('Portrait URL')).not.toBeInTheDocument();

    rerender(
      <StatBlockTab
        entity={entity}
        actions={makeActions()}
        editing={false}
        onTokenIdentityChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Portrait URL')).toBeInTheDocument();
  });

  it('shows the source label', () => {
    const entity = makeEntity({
      monsterStatBlock: makeStatBlock(),
      npcSourceId: 'npc-1',
    });
    render(
      <StatBlockTab entity={entity} actions={makeActions()} editing={false} />
    );
    expect(screen.getByText('NPC library')).toBeInTheDocument();
  });
});

describe('EffectsTab', () => {
  it('renders the condition/buff palette', () => {
    render(
      <EffectsTab
        entity={makeEntity()}
        actions={makeActions()}
        editing={false}
      />
    );
    expect(screen.getByText('Active Effects')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Blinded' })).toBeInTheDocument();
  });
});

describe('LairTab', () => {
  it("renders the lair actions' Use button and calls onUseLairAction", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    const entity = makeEntity({
      type: 'lair',
      lairActions: [
        {
          id: 'la1',
          name: 'Magma Fissure',
          description: 'Cracks open the ground.',
          usedThisRound: false,
        },
      ],
      regionalEffects: ['Water boils within 6 miles.'],
    });

    render(<LairTab entity={entity} actions={actions} editing={false} />);

    await user.click(screen.getByRole('button', { name: 'Use' }));
    expect(actions.onUseLairAction).toHaveBeenCalledWith('e1', 'la1');
    expect(screen.getByText('Water boils within 6 miles.')).toBeInTheDocument();
  });
});
