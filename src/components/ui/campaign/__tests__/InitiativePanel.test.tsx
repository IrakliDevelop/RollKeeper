import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { InitiativePanel } from '../InitiativePanel';
import type { SharedInitiativeState } from '@/types/sharedState';

const base: SharedInitiativeState = {
  encounterId: 'enc-1',
  isActive: true,
  round: 3,
  currentEntityId: 'a',
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
  afterEach(() => cleanup());

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
});
