import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EntityCard } from '@/components/ui/encounter/EntityCard';
import { InitiativeTracker } from '@/components/ui/encounter/InitiativeTracker';
import { MonsterStatBlockPanel } from '@/components/ui/encounter/MonsterStatBlockPanel';
import {
  EncounterEntity,
  Encounter,
  MonsterStatBlock,
} from '@/types/encounter';

const mockEntity: EncounterEntity = {
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

const mockEncounter: Encounter = {
  id: 'enc1',
  name: 'Test Encounter',
  entities: [mockEntity],
  currentTurn: 0,
  round: 1,
  isActive: true,
  sortOrder: 'initiative',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

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

const noop = vi.fn();

describe('EntityCard', () => {
  const defaultProps = {
    entity: mockEntity,
    isCurrentTurn: false,
    onUpdate: noop,
    onRemove: noop,
    onDamage: noop,
    onHeal: noop,
    onAddCondition: noop,
    onRemoveCondition: noop,
    onUseAbility: noop,
    onRestoreAbility: noop,
    onUseLegendaryAction: noop,
    onResetLegendaryActions: noop,
    onSetConcentration: noop,
    onSetInitiative: noop,
  };

  it('renders without crashing', () => {
    render(<EntityCard {...defaultProps} />);
  });

  it('displays entity name', () => {
    render(<EntityCard {...defaultProps} />);
    expect(screen.getAllByText('Goblin').length).toBeGreaterThanOrEqual(1);
  });

  it('displays entity type badge', () => {
    render(<EntityCard {...defaultProps} />);
    expect(screen.getAllByText('Monster').length).toBeGreaterThanOrEqual(1);
  });

  it('displays initiative value', () => {
    render(<EntityCard {...defaultProps} />);
    expect(screen.getAllByText('15').length).toBeGreaterThanOrEqual(1);
  });

  it('displays armor class', () => {
    render(<EntityCard {...defaultProps} />);
    expect(screen.getAllByText('15').length).toBeGreaterThanOrEqual(1);
  });
});

describe('InitiativeTracker', () => {
  const defaultProps = {
    encounter: mockEncounter,
    onStartCombat: noop,
    onEndCombat: noop,
    onNextTurn: noop,
    onPrevTurn: noop,
    onRollAllInitiatives: noop,
    onUpdateEntity: noop,
    onRemoveEntity: noop,
    onDamageEntity: noop,
    onHealEntity: noop,
    onAddCondition: noop,
    onRemoveCondition: noop,
    onUseAbility: noop,
    onRestoreAbility: noop,
    onUseLegendaryAction: noop,
    onResetLegendaryActions: noop,
    onSetConcentration: noop,
    onUseLairAction: noop,
    onSetInitiative: noop,
  };

  it('renders without crashing', () => {
    render(<InitiativeTracker {...defaultProps} />);
  });

  it('displays round number when combat is active', () => {
    render(<InitiativeTracker {...defaultProps} />);
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
  });

  it('displays current entity turn info', () => {
    render(<InitiativeTracker {...defaultProps} />);
    expect(screen.getAllByText('Goblin').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Next Turn and Prev buttons when active', () => {
    render(<InitiativeTracker {...defaultProps} />);
    expect(
      screen.getAllByRole('button', { name: /Next Turn/i }).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByRole('button', { name: /Prev/i }).length
    ).toBeGreaterThanOrEqual(1);
  });

  it('shows Start Combat button when inactive', () => {
    const inactiveEncounter = { ...mockEncounter, isActive: false };
    render(
      <InitiativeTracker {...defaultProps} encounter={inactiveEncounter} />
    );
    expect(
      screen.getAllByRole('button', { name: /Start Combat/i }).length
    ).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no entities', () => {
    const emptyEncounter = { ...mockEncounter, entities: [] };
    render(<InitiativeTracker {...defaultProps} encounter={emptyEncounter} />);
    expect(screen.getByText(/No combatants yet/i)).toBeInTheDocument();
  });
});

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
