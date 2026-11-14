import { useState, type ReactElement } from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render as rtlRender,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TooltipProvider } from '@/components/ui/primitives/Tooltip';
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
    enemyConditionsMode: 'off',
    updatedAt: '2026-07-08T12:00:00.000Z',
    ...overrides,
  };
}

// CombatPanel's Tooltip needs the provider PlayerVttScreen wraps around the
// floating panels, and Radix measures the trigger with ResizeObserver.
function render(ui: ReactElement) {
  const result = rtlRender(<TooltipProvider>{ui}</TooltipProvider>);
  return {
    ...result,
    rerender: (next: ReactElement) =>
      result.rerender(<TooltipProvider>{next}</TooltipProvider>),
  };
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

function noop() {
  // Intentional no-op for props that aren't asserted on in a given test.
}

describe('CombatPanel', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

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

    expect(screen.getByRole('heading', { name: 'Combat' })).toBeInTheDocument();
    expect(screen.getByText('Round 2 · 3 in order')).toBeInTheDocument();
    expect(screen.queryByText(/ROUND/)).not.toBeInTheDocument();
    expect(screen.queryByText(/IN ORDER/)).not.toBeInTheDocument();

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Goblin');
    expect(rows[1]).toHaveTextContent('Aria');
    expect(rows[2]).toHaveTextContent('Orc');
  });

  it('marks the player row with (you) and shows End my turn only on their active turn', () => {
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

    expect(screen.getByText('(you)')).toBeInTheDocument();
    expect(screen.queryByText('YOU')).not.toBeInTheDocument();
    const endTurnButton = screen.getByRole('button', {
      name: 'End my turn',
    });
    expect(endTurnButton).toBeInTheDocument();
    expect(endTurnButton).toHaveAttribute('data-variant', 'primary');

    fireEvent.click(endTurnButton);
    expect(handleEndTurn).toHaveBeenCalledWith('pc-1');
  });

  it('disables End my turn immediately after click, then hides it once the synced turn advances', () => {
    const handleEndTurn = vi.fn();
    const { rerender } = render(
      <CombatPanel
        state={buildState({ currentEntityId: 'pc-1' })}
        characterId={CHARACTER_ID}
        onEndTurn={handleEndTurn}
        collapsed={false}
        onToggleCollapsed={noop}
      />
    );

    const endTurnButton = screen.getByRole('button', {
      name: /end my turn/i,
    });
    fireEvent.click(endTurnButton);
    expect(handleEndTurn).toHaveBeenCalledWith('pc-1');
    // Optimistic pending: disabled while we wait for the poll to catch up,
    // so a slow sync can't let the player double-fire the request.
    expect(endTurnButton).toBeDisabled();

    // Server catches up: currentEntityId moves off pc-1 — button disappears
    // entirely since it's no longer this character's turn.
    rerender(
      <CombatPanel
        state={buildState({ currentEntityId: 'goblin-1' })}
        characterId={CHARACTER_ID}
        onEndTurn={handleEndTurn}
        collapsed={false}
        onToggleCollapsed={noop}
      />
    );
    expect(
      screen.queryByRole('button', { name: /end my turn/i })
    ).not.toBeInTheDocument();

    // Turn comes back around to the player later — button is re-enabled,
    // not stuck disabled from the earlier click.
    rerender(
      <CombatPanel
        state={buildState({ currentEntityId: 'pc-1' })}
        characterId={CHARACTER_ID}
        onEndTurn={handleEndTurn}
        collapsed={false}
        onToggleCollapsed={noop}
      />
    );
    expect(
      screen.getByRole('button', { name: /end my turn/i })
    ).not.toBeDisabled();
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

    // Identity marker still shows on the player's own row...
    expect(screen.getByText('(you)')).toBeInTheDocument();
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

    const percentText = screen.getByText('42%');
    expect(percentText).toBeInTheDocument();
    // 'mid' tier renders with the shared ember tier colour, not the flat faint tone.
    expect(percentText.className).toMatch(/text-ember-text/);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(
      rows[0].querySelector('.bg-surface-raised.rounded-full')
    ).not.toBeInTheDocument();
  });

  it('marks each disposition with a neutral glyph that has an accessible name', () => {
    const entries: SharedTurnEntry[] = [
      enemyEntry,
      {
        entityId: 'villager-1',
        displayName: 'Villager',
        type: 'npc',
        disposition: 'neutral',
        hpState: 'Healthy',
      },
      {
        entityId: 'knight-1',
        displayName: 'Knight',
        type: 'npc',
        disposition: 'ally',
        hpState: 'Healthy',
      },
    ];
    render(
      <CombatPanel
        state={buildState({ turnOrder: entries })}
        characterId={CHARACTER_ID}
        onEndTurn={noop}
        collapsed={false}
        onToggleCollapsed={noop}
      />
    );

    expect(screen.getByRole('img', { name: 'Enemy' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Neutral' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ally' })).toBeInTheDocument();
  });

  it('marks only the live current row with aria-current and Current turn', () => {
    render(
      <CombatPanel
        state={buildState()}
        characterId={CHARACTER_ID}
        onEndTurn={noop}
        collapsed={false}
        onToggleCollapsed={noop}
      />
    );

    const [goblinRow, ariaRow, orcRow] = screen.getAllByRole('listitem');
    expect(goblinRow).toHaveAttribute('aria-current', 'true');
    expect(goblinRow).toHaveTextContent('Current turn');
    expect(ariaRow).not.toHaveAttribute('aria-current');
    expect(ariaRow).not.toHaveTextContent('Current turn');
    expect(orcRow).not.toHaveAttribute('aria-current');
  });

  it('does not mark a defeated current row as the current turn', () => {
    render(
      <CombatPanel
        state={buildState({ currentEntityId: 'orc-1' })}
        characterId={CHARACTER_ID}
        onEndTurn={noop}
        collapsed={false}
        onToggleCollapsed={noop}
      />
    );

    const orcRow = screen.getAllByRole('listitem')[2];
    expect(orcRow).not.toHaveAttribute('aria-current');
    expect(orcRow).not.toHaveTextContent('Current turn');
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
    expect(rows[0].querySelector('[data-hp-track]')).toHaveClass(
      'bg-surface-inset'
    );
  });

  it('labels a defeated row Defeated', () => {
    render(
      <CombatPanel
        state={buildState()}
        characterId={CHARACTER_ID}
        onEndTurn={noop}
        collapsed={false}
        onToggleCollapsed={noop}
      />
    );

    const orcRow = screen
      .getAllByRole('listitem')
      .find(row => row.textContent?.includes('Orc'));
    expect(orcRow).toBeDefined();
    expect(orcRow).toHaveTextContent('Defeated');
  });

  it('collapses to a Combat pill and expands back', () => {
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

    const pill = screen.getByRole('button', { name: 'Combat' });
    expect(pill).toHaveAttribute('aria-expanded', 'false');
    expect(pill).not.toHaveAttribute('title');
    expect(screen.queryByText('INIT')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Expand combat panel' })
    ).not.toBeInTheDocument();
    // The full panel (round header) must not be rendered while collapsed.
    expect(screen.queryByText(/Round/)).not.toBeInTheDocument();

    fireEvent.click(pill);
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
    expect(screen.getByText(/Round/)).toBeInTheDocument();
    const collapse = screen.getByRole('button', {
      name: 'Collapse combat panel',
    });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(collapse);
    expect(handleToggleCollapsed).toHaveBeenCalledTimes(2);
  });

  it('moves focus to the Combat pill after collapsing and back to the collapse button after expanding', async () => {
    function Harness() {
      const [collapsed, setCollapsed] = useState(false);
      return (
        <CombatPanel
          state={buildState()}
          characterId={CHARACTER_ID}
          onEndTurn={noop}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed(c => !c)}
        />
      );
    }
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(
      screen.getByRole('button', { name: 'Collapse combat panel' })
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Combat' })).toHaveFocus()
    );

    await user.click(screen.getByRole('button', { name: 'Combat' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Collapse combat panel' })
      ).toHaveFocus()
    );
  });

  it('renders numeric HP for an enemy the DM toggled visible while the global mode is off', () => {
    const shownEnemy: SharedTurnEntry = {
      entityId: 'ogre-1',
      displayName: 'Ogre',
      type: 'monster',
      disposition: 'enemy',
      currentHp: 5,
      maxHp: 20,
      hpTier: 'critical',
      isDead: false,
      hpMode: 'exact',
    };
    render(
      <CombatPanel
        state={buildState({ enemyHpMode: 'off', turnOrder: [shownEnemy] })}
        characterId={CHARACTER_ID}
        onEndTurn={noop}
        collapsed={false}
        onToggleCollapsed={noop}
      />
    );

    expect(screen.getByText('5/20')).toBeInTheDocument();
  });

  it('resolves the HP mode per entry: entry hpMode wins over the state-level mode', () => {
    const percentOverride: SharedTurnEntry = {
      entityId: 'goblin-4',
      displayName: 'Worg',
      type: 'monster',
      disposition: 'enemy',
      hpPercent: 42,
      hpTier: 'mid',
      hpMode: 'percent',
    };
    render(
      <CombatPanel
        state={buildState({ enemyHpMode: 'bar', turnOrder: [percentOverride] })}
        characterId={CHARACTER_ID}
        onEndTurn={noop}
        collapsed={false}
        onToggleCollapsed={noop}
      />
    );

    // State mode 'bar' alone would draw a bar with no text; the per-entry
    // 'percent' override renders the percentage text instead.
    expect(screen.getByText('42%')).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(
      rows[0].querySelector('.bg-surface-raised.rounded-full')
    ).not.toBeInTheDocument();
  });
});
