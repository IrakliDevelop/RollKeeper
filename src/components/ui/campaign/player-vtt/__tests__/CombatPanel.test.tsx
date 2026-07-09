import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { CombatPanel } from '@/components/ui/campaign/player-vtt/CombatPanel';
import type {
  SharedInitiativeState,
  SharedTurnEntry,
} from '@/types/sharedState';

const CHARACTER_ID = 'char-123';

// Masked enemy — HP arrives as a label string (enemyHpMode: 'label').
const enemyEntry: SharedTurnEntry = {
  entityId: 'goblin-1',
  displayName: 'Goblin',
  type: 'monster',
  disposition: 'enemy',
  hpState: 'Bloodied',
  hpTier: 'mid',
};

// The open character's own combatant — players always get numeric HP.
const playerEntry: SharedTurnEntry = {
  entityId: 'pc-1',
  displayName: 'Aria',
  type: 'player',
  playerCharacterId: CHARACTER_ID,
  currentHp: 18,
  maxHp: 30,
  isDead: false,
};

// A defeated enemy — HP fully masked (no hpState carried through once dead).
const defeatedEntry: SharedTurnEntry = {
  entityId: 'orc-1',
  displayName: 'Orc',
  type: 'monster',
  disposition: 'enemy',
  isDead: true,
};

function buildState(
  overrides: Partial<SharedInitiativeState> = {}
): SharedInitiativeState {
  return {
    encounterId: 'enc-1',
    isActive: true,
    round: 2,
    currentEntityId: 'goblin-1',
    turnOrder: [enemyEntry, playerEntry, defeatedEntry],
    enemyHpMode: 'label',
    updatedAt: '2026-07-08T12:00:00.000Z',
    ...overrides,
  };
}

function noop() {
  // Intentional no-op for props that aren't asserted on in a given test.
}

describe('CombatPanel', () => {
  afterEach(() => cleanup());

  it('renders nothing when combat is inactive or state is null', () => {
    const { container: nullContainer } = render(
      <CombatPanel
        state={null}
        characterId={CHARACTER_ID}
        onEndTurn={noop}
        collapsed={false}
        onToggleCollapsed={noop}
      />
    );
    expect(nullContainer).toBeEmptyDOMElement();

    const { container: inactiveContainer } = render(
      <CombatPanel
        state={buildState({ isActive: false })}
        characterId={CHARACTER_ID}
        onEndTurn={noop}
        collapsed={false}
        onToggleCollapsed={noop}
      />
    );
    expect(inactiveContainer).toBeEmptyDOMElement();
  });

  it('renders round header and one row per entry in server order', () => {
    render(
      <CombatPanel
        state={buildState()}
        characterId={CHARACTER_ID}
        onEndTurn={noop}
        collapsed={false}
        onToggleCollapsed={noop}
      />
    );

    expect(screen.getByText(/ROUND\s*2/)).toBeInTheDocument();
    expect(screen.getByText(/3 IN ORDER/i)).toBeInTheDocument();

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Goblin');
    expect(rows[1]).toHaveTextContent('Aria');
    expect(rows[2]).toHaveTextContent('Orc');
  });

  it('marks the player row with YOU and shows End my turn only on their active turn', () => {
    const handleEndTurn = vi.fn();
    render(
      <CombatPanel
        state={buildState({ currentEntityId: 'pc-1' })}
        characterId={CHARACTER_ID}
        onEndTurn={handleEndTurn}
        collapsed={false}
        onToggleCollapsed={noop}
      />
    );

    expect(screen.getByText('YOU')).toBeInTheDocument();
    const endTurnButton = screen.getByRole('button', {
      name: /end my turn/i,
    });
    expect(endTurnButton).toBeInTheDocument();

    fireEvent.click(endTurnButton);
    expect(handleEndTurn).toHaveBeenCalledWith('pc-1');
  });

  it("hides End my turn when it is not the player's turn", () => {
    render(
      <CombatPanel
        state={buildState({ currentEntityId: 'goblin-1' })}
        characterId={CHARACTER_ID}
        onEndTurn={noop}
        collapsed={false}
        onToggleCollapsed={noop}
      />
    );

    // Identity badge still shows on the player's own row...
    expect(screen.getByText('YOU')).toBeInTheDocument();
    // ...but it isn't their turn, so no end-turn control.
    expect(
      screen.queryByRole('button', { name: /end my turn/i })
    ).not.toBeInTheDocument();
  });

  it('renders masked HP labels verbatim and numeric HP as a bar', () => {
    render(
      <CombatPanel
        state={buildState()}
        characterId={CHARACTER_ID}
        onEndTurn={noop}
        collapsed={false}
        onToggleCollapsed={noop}
      />
    );

    // Enemy: masked label string rendered verbatim, no numbers leaked.
    expect(screen.getByText('Bloodied')).toBeInTheDocument();
    expect(screen.queryByText(/goblin.*\d/i)).not.toBeInTheDocument();

    // Player: real numeric HP rendered via the HPBar label.
    expect(screen.getByText('18/30')).toBeInTheDocument();
  });

  it('renders enemy hpPercent as text only when enemyHpMode is percent', () => {
    const percentEnemy: SharedTurnEntry = {
      entityId: 'goblin-2',
      displayName: 'Hobgoblin',
      type: 'monster',
      disposition: 'enemy',
      hpPercent: 42,
      hpTier: 'mid',
    };
    render(
      <CombatPanel
        state={buildState({
          enemyHpMode: 'percent',
          turnOrder: [percentEnemy],
        })}
        characterId={CHARACTER_ID}
        onEndTurn={noop}
        collapsed={false}
        onToggleCollapsed={noop}
      />
    );

    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(
      rows[0].querySelector('.bg-surface-raised.rounded-full')
    ).not.toBeInTheDocument();
  });

  it('renders enemy hpPercent as a bar only when enemyHpMode is bar', () => {
    const barEnemy: SharedTurnEntry = {
      entityId: 'goblin-3',
      displayName: 'Bugbear',
      type: 'monster',
      disposition: 'enemy',
      hpPercent: 65,
      hpTier: 'mid',
    };
    render(
      <CombatPanel
        state={buildState({
          enemyHpMode: 'bar',
          turnOrder: [barEnemy],
        })}
        characterId={CHARACTER_ID}
        onEndTurn={noop}
        collapsed={false}
        onToggleCollapsed={noop}
      />
    );

    expect(screen.queryByText('65%')).not.toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(
      rows[0].querySelector('.bg-surface-raised.rounded-full')
    ).toBeInTheDocument();
  });

  it('applies defeated styling', () => {
    render(
      <CombatPanel
        state={buildState()}
        characterId={CHARACTER_ID}
        onEndTurn={noop}
        collapsed={false}
        onToggleCollapsed={noop}
      />
    );

    const rows = screen.getAllByRole('listitem');
    const orcRow = rows.find(row => row.textContent?.includes('Orc'));
    expect(orcRow).toBeDefined();
    expect(orcRow?.className).toEqual(expect.stringContaining('opacity-50'));
    expect(orcRow?.className).toEqual(expect.stringContaining('line-through'));
  });

  it('collapses to an edge tab and expands back', () => {
    const handleToggleCollapsed = vi.fn();
    const { rerender } = render(
      <CombatPanel
        state={buildState()}
        characterId={CHARACTER_ID}
        onEndTurn={noop}
        collapsed={true}
        onToggleCollapsed={handleToggleCollapsed}
      />
    );

    const edgeTab = screen.getByRole('button', { name: /initiative/i });
    expect(edgeTab).toBeInTheDocument();
    // The full panel (round header) must not be rendered while collapsed.
    expect(screen.queryByText(/ROUND/)).not.toBeInTheDocument();

    fireEvent.click(edgeTab);
    expect(handleToggleCollapsed).toHaveBeenCalledTimes(1);

    rerender(
      <CombatPanel
        state={buildState()}
        characterId={CHARACTER_ID}
        onEndTurn={noop}
        collapsed={false}
        onToggleCollapsed={handleToggleCollapsed}
      />
    );
    expect(screen.getByText(/ROUND/)).toBeInTheDocument();
  });
});
