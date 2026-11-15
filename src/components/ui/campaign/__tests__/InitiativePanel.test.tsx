import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { InitiativePanel } from '../InitiativePanel';
import type { SharedInitiativeState } from '@/types/sharedState';

const base: SharedInitiativeState = {
  encounterId: 'enc-1',
  isActive: true,
  round: 3,
  currentEntityId: 'a',
  enemyHpMode: 'off',
  enemyConditionsMode: 'off',
  turnOrder: [
    {
      entityId: 'a',
      displayName: 'Aragorn',
      type: 'player',
      playerCharacterId: 'char-a',
      currentHp: 24,
      maxHp: 30,
    },
    { entityId: 'm', displayName: 'Enemy', type: 'monster' },
  ],
  updatedAt: '',
};

const noop = () => {};

describe('InitiativePanel', () => {
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

  afterEach(() => {
    cleanup();
    localStorage.removeItem('rollkeeper-initiative-panel-y');
    localStorage.removeItem('rollkeeper-initiative-panel-open');
    vi.unstubAllGlobals();
  });

  it('clamps a saved low position above the sheet floating stack', () => {
    localStorage.setItem('rollkeeper-initiative-panel-y', '700');
    vi.stubGlobal('innerHeight', 800);
    render(
      <InitiativePanel
        state={base}
        characterId="char-a"
        onEndTurn={noop}
        bottomReservedHeight={400}
      />
    );
    const panel = screen
      .getByRole('button', { name: /initiative/i })
      .closest('.fixed');
    expect(panel).toHaveStyle({ top: '280px' });
    expect(localStorage.getItem('rollkeeper-initiative-panel-y')).toBe('700');
  });

  it('renders nothing when there is no active initiative', () => {
    const { container } = render(
      <InitiativePanel state={null} characterId="char-a" onEndTurn={noop} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the round and ordered combatants when active', () => {
    render(
      <InitiativePanel state={base} characterId="char-a" onEndTurn={noop} />
    );
    expect(screen.getByText(/Round 3/i)).toBeInTheDocument();
    expect(screen.getByText('Aragorn')).toBeInTheDocument();
    expect(screen.getByText('Enemy')).toBeInTheDocument();
  });

  it("shows the End my turn button only when it is the open character's turn", () => {
    const { rerender } = render(
      <InitiativePanel state={base} characterId="char-a" onEndTurn={noop} />
    );
    expect(
      screen.getByRole('button', { name: /end my turn/i })
    ).toBeInTheDocument();

    // Different character open → no button
    rerender(
      <InitiativePanel state={base} characterId="char-b" onEndTurn={noop} />
    );
    expect(
      screen.queryByRole('button', { name: /end my turn/i })
    ).not.toBeInTheDocument();
  });

  it('calls onEndTurn with the active entity when the button is clicked', async () => {
    const onEndTurn = vi.fn();
    const { default: userEvent } = await import('@testing-library/user-event');
    render(
      <InitiativePanel
        state={base}
        characterId="char-a"
        onEndTurn={onEndTurn}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /end my turn/i }));
    expect(onEndTurn).toHaveBeenCalledWith('a');
  });

  it('optimistically advances the highlight and hides the button after ending turn', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    // Same synced state throughout (props do not change) — the panel should
    // still reflect the ended turn locally.
    render(
      <InitiativePanel state={base} characterId="char-a" onEndTurn={noop} />
    );
    expect(
      screen.getByRole('button', { name: /end my turn/i })
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /end my turn/i }));

    // It is no longer the open character's turn locally, so the button is gone
    // even though the synced `state` prop has not changed yet.
    expect(
      screen.queryByRole('button', { name: /end my turn/i })
    ).not.toBeInTheDocument();
  });

  it('renders nothing when initiative is present but combat is not active', () => {
    const { container } = render(
      <InitiativePanel
        state={{ ...base, isActive: false }}
        characterId="char-a"
        onEndTurn={noop}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows exact HP for an enemy the DM toggled visible while the global mode is off', () => {
    render(
      <InitiativePanel
        state={{
          ...base,
          enemyHpMode: 'off',
          turnOrder: [
            base.turnOrder[0],
            {
              entityId: 'm',
              displayName: 'Ogre',
              type: 'monster',
              currentHp: 5,
              maxHp: 20,
              hpTier: 'critical',
              isDead: false,
              hpMode: 'exact',
            },
          ],
        }}
        characterId="char-a"
        onEndTurn={noop}
      />
    );
    expect(screen.getByText('5/20')).toBeInTheDocument();
  });

  it('resolves the HP mode per entry: entry hpMode wins over the state-level mode', () => {
    render(
      <InitiativePanel
        state={{
          ...base,
          enemyHpMode: 'bar',
          turnOrder: [
            base.turnOrder[0],
            {
              entityId: 'm',
              displayName: 'Worg',
              type: 'monster',
              hpPercent: 42,
              hpTier: 'mid',
              hpMode: 'percent',
            },
          ],
        }}
        characterId="char-a"
        onEndTurn={noop}
      />
    );
    // State mode 'bar' alone renders no HP text for this row.
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('shows "Defeated" and "Down", never a band word, when a payload still carries one at 0 HP', () => {
    // A DM tab opened before 02a and not reloaded, but holding the upgraded
    // bands, still sends the lowest band's word on dead rows.
    render(
      <InitiativePanel
        state={{
          ...base,
          enemyHpMode: 'label',
          turnOrder: [
            {
              entityId: 'g',
              displayName: 'Goblin',
              type: 'monster',
              disposition: 'enemy',
              hpState: 'Critical',
              isDead: true,
            },
            {
              entityId: 'c',
              displayName: 'Caleb',
              type: 'player',
              playerCharacterId: 'char-c',
              hpMode: 'label',
              hpState: 'Critical',
              isDead: true,
            },
          ],
        }}
        characterId="char-b"
        onEndTurn={noop}
      />
    );
    expect(screen.getByText('Defeated')).toBeInTheDocument();
    expect(screen.getByText('Down')).toBeInTheDocument();
    expect(screen.queryByText('Critical')).not.toBeInTheDocument();
  });

  it('shows the HP-state word (not exact HP) for a player who opted out of sharing', () => {
    render(
      <InitiativePanel
        state={{
          ...base,
          turnOrder: [
            {
              entityId: 'a',
              displayName: 'Aragorn',
              type: 'player',
              playerCharacterId: 'char-a',
              hpMode: 'label',
              hpState: 'Bloodied',
              hpTier: 'low',
              isDead: false,
            },
          ],
        }}
        characterId="char-b"
        onEndTurn={noop}
      />
    );
    expect(screen.getByText('Bloodied')).toBeInTheDocument();
    expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument();
    // Tier-coloured, like an enemy's label row — not the neutral player shade.
    expect(screen.getByText('Bloodied')).toHaveClass('text-ember-text');
  });

  it('marks the current combatant with aria-current and Current turn text', () => {
    render(
      <InitiativePanel
        state={{ ...base, currentEntityId: 'm' }}
        characterId="char-b"
        onEndTurn={noop}
      />
    );
    const current = screen.getByText('Enemy').closest('li')!;
    expect(current).toHaveAttribute('aria-current', 'true');
    expect(within(current).getByText('Current turn')).toBeInTheDocument();
    expect(screen.getAllByText('Current turn')).toHaveLength(1);
    const other = screen.getByText('Aragorn').closest('li')!;
    expect(other).not.toHaveAttribute('aria-current');
  });

  it('moves Current turn to the next combatant on End my turn before the sync catches up', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    render(
      <InitiativePanel state={base} characterId="char-a" onEndTurn={noop} />
    );
    const mine = screen.getByText('Aragorn').closest('li')!;
    expect(mine).toHaveAttribute('aria-current', 'true');

    await userEvent.click(screen.getByRole('button', { name: /end my turn/i }));

    const next = screen.getByText('Enemy').closest('li')!;
    expect(next).toHaveAttribute('aria-current', 'true');
    expect(within(next).getByText('Current turn')).toBeInTheDocument();
    expect(mine).not.toHaveAttribute('aria-current');
    expect(within(mine).queryByText('Current turn')).not.toBeInTheDocument();
  });

  it('does not mark a dead current combatant', () => {
    const makeState = (isDead: boolean) => ({
      ...base,
      currentEntityId: 'm',
      turnOrder: [
        base.turnOrder[0],
        {
          entityId: 'm',
          displayName: 'Enemy',
          type: 'monster' as const,
          isDead,
        },
      ],
    });
    const { rerender } = render(
      <InitiativePanel
        state={makeState(true)}
        characterId="char-b"
        onEndTurn={noop}
      />
    );
    const deadRow = screen.getByText('Enemy').closest('li')!;
    expect(deadRow).not.toHaveAttribute('aria-current');
    expect(screen.queryByText('Current turn')).not.toBeInTheDocument();

    rerender(
      <InitiativePanel
        state={makeState(false)}
        characterId="char-b"
        onEndTurn={noop}
      />
    );
    const aliveRow = screen.getByText('Enemy').closest('li')!;
    expect(aliveRow).toHaveAttribute('aria-current', 'true');
    expect(within(aliveRow).getByText('Current turn')).toBeInTheDocument();
  });

  it('names the side glyphs', () => {
    render(
      <InitiativePanel
        state={{
          ...base,
          turnOrder: [
            {
              entityId: 'x',
              displayName: 'Ally NPC',
              type: 'monster',
              disposition: 'ally',
            },
            {
              entityId: 'y',
              displayName: 'Neutral NPC',
              type: 'monster',
              disposition: 'neutral',
            },
            {
              entityId: 'z',
              displayName: 'Enemy NPC',
              type: 'monster',
              disposition: 'enemy',
            },
          ],
        }}
        characterId="char-b"
        onEndTurn={noop}
      />
    );
    expect(screen.getByRole('img', { name: 'Ally' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Neutral' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Enemy' })).toBeInTheDocument();
  });

  it('collapsed handle shows the round and reports aria-expanded', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    render(
      <InitiativePanel state={base} characterId="char-b" onEndTurn={noop} />
    );
    // Combat activation auto-opens the panel on mount.
    const hide = screen.getByRole('button', { name: 'Hide initiative' });
    expect(hide).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(hide);
    const show = screen.getByRole('button', { name: 'Show initiative' });
    expect(show).toHaveAttribute('aria-expanded', 'false');
    expect(show).toHaveTextContent('3');

    await userEvent.click(show);
    expect(
      screen.getByRole('button', { name: 'Hide initiative' })
    ).toHaveAttribute('aria-expanded', 'true');
  });
});
