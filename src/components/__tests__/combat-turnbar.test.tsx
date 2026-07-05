// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CombatTurnBar } from '@/components/ui/encounter/combat-screen/CombatTurnBar';
import type { Encounter, EncounterEntity } from '@/types/encounter';

afterEach(cleanup);

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

const thorin: EncounterEntity = {
  id: 'e2',
  type: 'player',
  name: 'Thorin',
  initiative: 18,
  initiativeModifier: 2,
  currentHp: 35,
  maxHp: 44,
  tempHp: 0,
  armorClass: 18,
  conditions: [],
};

const emptyEncounter: Encounter = {
  id: 'enc-1',
  name: 'Test Encounter',
  entities: [],
  currentTurn: 0,
  round: 1,
  isActive: false,
  sortOrder: 'initiative',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const populatedEncounter: Encounter = {
  ...emptyEncounter,
  entities: [goblin, thorin],
};

const activeEncounter: Encounter = {
  ...populatedEncounter,
  isActive: true,
  currentTurn: 0,
  round: 2,
};

const baseProps = {
  layout: 'rail' as const,
  hidePlayerHp: false,
  onToggleHidePlayerHp: vi.fn(),
  onStartCombat: vi.fn(),
  onEndCombat: vi.fn(),
  onNextTurn: vi.fn(),
  onPrevTurn: vi.fn(),
  onRollAllInitiatives: vi.fn(),
};

describe('CombatTurnBar — pre-combat', () => {
  it('Start Combat is disabled when encounter has no entities', () => {
    render(<CombatTurnBar {...baseProps} encounter={emptyEncounter} />);
    expect(
      screen.getByRole('button', { name: /start combat/i })
    ).toBeDisabled();
  });

  it('Start Combat is enabled when encounter has entities', () => {
    render(<CombatTurnBar {...baseProps} encounter={populatedEncounter} />);
    expect(
      screen.getByRole('button', { name: /start combat/i })
    ).not.toBeDisabled();
  });

  it('renders Roll Initiatives button', () => {
    render(<CombatTurnBar {...baseProps} encounter={emptyEncounter} />);
    expect(
      screen.getByRole('button', { name: /roll initiatives/i })
    ).toBeInTheDocument();
  });
});

describe('CombatTurnBar — active combat (rail)', () => {
  it('renders round number', () => {
    render(<CombatTurnBar {...baseProps} encounter={activeEncounter} />);
    expect(screen.getByText(/round 2/i)).toBeInTheDocument();
  });

  it('renders active combatant name', () => {
    render(<CombatTurnBar {...baseProps} encounter={activeEncounter} />);
    expect(screen.getByText('Goblin')).toBeInTheDocument();
  });

  it('renders on-deck combatant name', () => {
    render(<CombatTurnBar {...baseProps} encounter={activeEncounter} />);
    expect(screen.getByText('Thorin')).toBeInTheDocument();
  });

  it('calls onNextTurn when Next Turn clicked', () => {
    const onNextTurn = vi.fn();
    render(
      <CombatTurnBar
        {...baseProps}
        encounter={activeEncounter}
        onNextTurn={onNextTurn}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /next turn/i }));
    expect(onNextTurn).toHaveBeenCalledOnce();
  });

  it('calls onPrevTurn when Prev clicked', () => {
    const onPrevTurn = vi.fn();
    render(
      <CombatTurnBar
        {...baseProps}
        encounter={activeEncounter}
        onPrevTurn={onPrevTurn}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /prev/i }));
    expect(onPrevTurn).toHaveBeenCalledOnce();
  });

  it('calls onEndCombat when End Combat clicked', () => {
    const onEndCombat = vi.fn();
    render(
      <CombatTurnBar
        {...baseProps}
        encounter={activeEncounter}
        onEndCombat={onEndCombat}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /end combat/i }));
    expect(onEndCombat).toHaveBeenCalledOnce();
  });

  it('calls onToggleHidePlayerHp when Player HP clicked', () => {
    const onToggleHidePlayerHp = vi.fn();
    render(
      <CombatTurnBar
        {...baseProps}
        encounter={activeEncounter}
        onToggleHidePlayerHp={onToggleHidePlayerHp}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /player hp/i }));
    expect(onToggleHidePlayerHp).toHaveBeenCalledOnce();
  });
});

describe('CombatTurnBar — active combat (focus)', () => {
  it('renders round and Now Playing label', () => {
    render(
      <CombatTurnBar
        {...baseProps}
        layout="focus"
        encounter={activeEncounter}
      />
    );
    expect(screen.getByText(/now playing/i)).toBeInTheDocument();
  });

  it('renders active combatant name in focus layout', () => {
    render(
      <CombatTurnBar
        {...baseProps}
        layout="focus"
        encounter={activeEncounter}
      />
    );
    expect(screen.getByText('Goblin')).toBeInTheDocument();
  });
});
