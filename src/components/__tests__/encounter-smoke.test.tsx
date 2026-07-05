import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CombatScreen } from '@/components/ui/encounter/combat-screen/CombatScreen';
import { buildEntityActions } from '@/components/ui/encounter/combat-screen/buildEntityActions';
import { MonsterStatBlockPanel } from '@/components/ui/encounter/MonsterStatBlockPanel';
import type {
  EncounterEntity,
  Encounter,
  MonsterStatBlock,
} from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

// Mock window.matchMedia to return matches=true → rail layout
function mockMatchMedia(matches = true) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

beforeEach(() => {
  mockMatchMedia(true);
});

afterEach(cleanup);

// ── Fixtures ────────────────────────────────────────────────────────────────

const goblin: EncounterEntity = {
  id: 'e1',
  type: 'monster',
  name: 'Goblin',
  initiative: 15,
  initiativeModifier: 2,
  currentHp: 7,
  maxHp: 7,
  tempHp: 0,
  armorClass: 15,
  conditions: [],
};

const dragon: EncounterEntity = {
  id: 'e2',
  type: 'monster',
  name: 'Dragon',
  initiative: 20,
  initiativeModifier: 5,
  currentHp: 120,
  maxHp: 120,
  tempHp: 0,
  armorClass: 19,
  conditions: [],
};

const activeEncounter: Encounter = {
  id: 'enc1',
  name: 'Test Encounter',
  entities: [goblin, dragon],
  currentTurn: 0,
  round: 1,
  isActive: true,
  sortOrder: 'initiative',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

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

function makeProps(overrides: Partial<{ encounter: Encounter }> = {}) {
  return {
    encounter: activeEncounter,
    actions: makeActions(),
    onStartCombat: vi.fn(),
    onEndCombat: vi.fn(),
    onNextTurn: vi.fn(),
    onPrevTurn: vi.fn(),
    onRollAllInitiatives: vi.fn(),
    onRename: vi.fn(),
    onOpenAdd: vi.fn(),
    onOpenConfig: vi.fn(),
    backHref: '/encounters',
    ...overrides,
  };
}

// ── CombatScreen ─────────────────────────────────────────────────────────────

describe('CombatScreen', () => {
  it('renders rows for all entities', () => {
    render(<CombatScreen {...makeProps()} />);
    expect(screen.getAllByText('Goblin').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Dragon').length).toBeGreaterThanOrEqual(1);
  });

  it('shows active entity in detail pane by default (rail)', () => {
    // currentTurn=0 → Goblin is active → appears in both row and detail pane
    render(<CombatScreen {...makeProps()} />);
    expect(screen.getAllByText('Goblin').length).toBeGreaterThanOrEqual(2);
  });

  it('clicking a row shows entity name in the detail pane', () => {
    render(<CombatScreen {...makeProps()} />);
    // Initially Goblin is in detail pane; Dragon only in the row
    const dragonOccurrences = screen.getAllByText('Dragon');
    // Click the Dragon row
    fireEvent.click(dragonOccurrences[0]);
    // Dragon should now appear in both row and detail pane
    expect(screen.getAllByText('Dragon').length).toBeGreaterThanOrEqual(2);
  });

  it('auto-selects active entity on turn change', () => {
    const { rerender } = render(<CombatScreen {...makeProps()} />);
    // Turn 0 = Goblin is active → appears in row + detail
    expect(screen.getAllByText('Goblin').length).toBeGreaterThanOrEqual(2);

    // Advance to turn 1 → Dragon becomes active
    rerender(
      <CombatScreen
        {...makeProps({ encounter: { ...activeEncounter, currentTurn: 1 } })}
      />
    );
    expect(screen.getAllByText('Dragon').length).toBeGreaterThanOrEqual(2);
  });

  it('shows empty state when no entities', () => {
    const emptyEncounter = {
      ...activeEncounter,
      entities: [],
      isActive: false,
    };
    render(<CombatScreen {...makeProps({ encounter: emptyEncounter })} />);
    expect(screen.getByText(/No combatants yet/i)).toBeInTheDocument();
  });
});

// ── helpers for buildEntityActions tests ─────────────────────────────────────

const BUILD_ENC_ID = 'enc-test';

function makeStore() {
  return {
    updateEntity: vi.fn(),
    removeEntity: vi.fn(),
    damageEntity: vi.fn(),
    healEntity: vi.fn(),
    addTempHp: vi.fn(),
    setEntityHp: vi.fn(),
    addCondition: vi.fn(),
    removeCondition: vi.fn(),
    setConditionRounds: vi.fn(),
    useAbility: vi.fn(),
    restoreAbility: vi.fn(),
    useLegendaryAction: vi.fn(),
    resetLegendaryActions: vi.fn(),
    setConcentration: vi.fn(),
    useLairAction: vi.fn(),
    setInitiative: vi.fn(),
    longRestEntity: vi.fn(),
  };
}

function makeBuildEncounter(entities: EncounterEntity[]): Encounter {
  return {
    id: BUILD_ENC_ID,
    name: 'Build Test',
    entities,
    currentTurn: 0,
    round: 1,
    isActive: false,
    sortOrder: 'initiative',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ── buildEntityActions › onSetMaxHp ──────────────────────────────────────────

describe('buildEntityActions › onSetMaxHp', () => {
  it('clamps currentHp to new max when max is lowered below currentHp', () => {
    const entity: EncounterEntity = {
      ...goblin,
      id: 'e1',
      currentHp: 10,
      maxHp: 12,
    };
    const store = makeStore();
    const actions = buildEntityActions({
      encounterId: BUILD_ENC_ID,
      encounter: makeBuildEncounter([entity]),
      store,
      syncPlayerEffects: vi.fn(),
    });

    actions.onSetMaxHp('e1', 5);
    expect(store.setEntityHp).toHaveBeenCalledWith(BUILD_ENC_ID, 'e1', 5, 5);
  });

  it('preserves currentHp when max is raised above currentHp', () => {
    const entity: EncounterEntity = {
      ...goblin,
      id: 'e1',
      currentHp: 10,
      maxHp: 12,
    };
    const store = makeStore();
    const actions = buildEntityActions({
      encounterId: BUILD_ENC_ID,
      encounter: makeBuildEncounter([entity]),
      store,
      syncPlayerEffects: vi.fn(),
    });

    actions.onSetMaxHp('e1', 20);
    expect(store.setEntityHp).toHaveBeenCalledWith(BUILD_ENC_ID, 'e1', 10, 20);
  });
});

// ── buildEntityActions › summon cascade ──────────────────────────────────────

describe('buildEntityActions › summon cascade on remove', () => {
  it('also removes summon entities when a player entity is removed', () => {
    const player: EncounterEntity = {
      ...goblin,
      id: 'p1-entity',
      type: 'player',
      playerCharacterId: 'p1',
    };
    const summon: EncounterEntity = {
      ...goblin,
      id: 's1-entity',
      type: 'monster',
      summonOwnerId: 'p1',
    };
    const other: EncounterEntity = { ...goblin, id: 'o1-entity' };
    const store = makeStore();
    const actions = buildEntityActions({
      encounterId: BUILD_ENC_ID,
      encounter: makeBuildEncounter([player, summon, other]),
      store,
      syncPlayerEffects: vi.fn(),
    });

    actions.onRemove('p1-entity');

    expect(store.removeEntity).toHaveBeenCalledWith(BUILD_ENC_ID, 's1-entity');
    expect(store.removeEntity).toHaveBeenCalledWith(BUILD_ENC_ID, 'p1-entity');
    expect(store.removeEntity).not.toHaveBeenCalledWith(
      BUILD_ENC_ID,
      'o1-entity'
    );
  });
});

// ── MonsterStatBlockPanel ─────────────────────────────────────────────────────

const mockStatBlock: MonsterStatBlock = {
  str: 8,
  dex: 14,
  con: 10,
  int: 10,
  wis: 8,
  cha: 8,
  saves: '',
  skills: 'Stealth +6',
  speed: '30 ft.',
  resistances: '',
  immunities: '',
  vulnerabilities: '',
  conditionImmunities: [],
  senses: 'darkvision 60 ft.',
  passivePerception: 9,
  traits: [],
  actions: [
    {
      name: 'Scimitar',
      text: 'Melee Weapon Attack: +4 to hit, 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.',
    },
  ],
  reactions: [],
  bonusActions: [],
  lairActions: [],
  cr: '1/4',
  type: 'humanoid',
  size: 'Small',
  languages: 'Common, Goblin',
  alignment: 'neutral evil',
  hpFormula: '2d6',
};

describe('MonsterStatBlockPanel', () => {
  it('renders without crashing', () => {
    render(<MonsterStatBlockPanel statBlock={mockStatBlock} />);
  });

  it('displays size, type, alignment, and CR', () => {
    render(<MonsterStatBlockPanel statBlock={mockStatBlock} />);
    expect(
      screen.getAllByText(/Small humanoid, neutral evil/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it('displays ability scores', () => {
    render(<MonsterStatBlockPanel statBlock={mockStatBlock} />);
    expect(screen.getAllByText('str').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('dex').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('14').length).toBeGreaterThanOrEqual(1);
  });

  it('displays ability modifiers', () => {
    render(<MonsterStatBlockPanel statBlock={mockStatBlock} />);
    expect(screen.getAllByText('(+2)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('(-1)').length).toBeGreaterThanOrEqual(1);
  });

  it('displays speed', () => {
    render(<MonsterStatBlockPanel statBlock={mockStatBlock} />);
    expect(screen.getAllByText('30 ft.').length).toBeGreaterThanOrEqual(1);
  });

  it('displays skills', () => {
    render(<MonsterStatBlockPanel statBlock={mockStatBlock} />);
    expect(screen.getAllByText('Stealth +6').length).toBeGreaterThanOrEqual(1);
  });

  it('displays actions', () => {
    render(<MonsterStatBlockPanel statBlock={mockStatBlock} />);
    expect(screen.getAllByText('Actions').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Scimitar\./).length).toBeGreaterThanOrEqual(1);
  });

  it('displays senses with passive perception', () => {
    render(<MonsterStatBlockPanel statBlock={mockStatBlock} />);
    expect(
      screen.getAllByText(/darkvision 60 ft/).length
    ).toBeGreaterThanOrEqual(1);
  });

  it('displays languages', () => {
    render(<MonsterStatBlockPanel statBlock={mockStatBlock} />);
    expect(screen.getAllByText('Common, Goblin').length).toBeGreaterThanOrEqual(
      1
    );
  });
});
