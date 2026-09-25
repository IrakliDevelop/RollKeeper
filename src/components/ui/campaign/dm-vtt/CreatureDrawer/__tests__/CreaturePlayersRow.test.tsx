import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { CreaturePlayersRow } from '../CreaturePlayersRow';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

afterEach(() => cleanup());

function makeEntity(overrides: Partial<EncounterEntity> = {}): EncounterEntity {
  return {
    id: 'e1',
    type: 'monster',
    name: 'Goblin Boss',
    initiative: null,
    initiativeModifier: 2,
    currentHp: 10,
    maxHp: 10,
    tempHp: 0,
    armorClass: 15,
    conditions: [],
    ...overrides,
  };
}

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
    onSpendResource: vi.fn(),
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

describe('CreaturePlayersRow', () => {
  it('renders for a lair entity (Studio lair layout keeps HeaderControls)', () => {
    const actions = makeActions();
    render(
      <CreaturePlayersRow
        entity={makeEntity({ type: 'lair' })}
        actions={actions}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Neutral' }));
    expect(actions.onUpdate).toHaveBeenCalledWith(expect.any(String), {
      playerDisposition: 'neutral',
    });
  });

  it('sets playerDisposition when a segment is clicked, aria-pressed on the active one', () => {
    const actions = makeActions();
    render(<CreaturePlayersRow entity={makeEntity()} actions={actions} />);
    const ally = screen.getByRole('button', { name: 'Ally' });
    const enemy = screen.getByRole('button', { name: 'Enemy' });
    expect(enemy).toHaveAttribute('aria-pressed', 'true');
    expect(ally).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(ally);
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      playerDisposition: 'ally',
    });
  });

  it('toggles isHidden', () => {
    const actions = makeActions();
    render(<CreaturePlayersRow entity={makeEntity()} actions={actions} />);
    fireEvent.click(
      screen.getByTitle('Name visible to players — click to hide')
    );
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', { isHidden: true });
  });

  it('toggles hpVisibleToPlayers with the same aria-label as HeaderControls', () => {
    const actions = makeActions();
    render(<CreaturePlayersRow entity={makeEntity()} actions={actions} />);
    const toggle = screen.getByRole('button', {
      name: 'Show exact HP to players',
    });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      hpVisibleToPlayers: true,
    });
  });

  it('commits a trimmed-or-undefined alias on blur', () => {
    const actions = makeActions();
    render(<CreaturePlayersRow entity={makeEntity()} actions={actions} />);
    const input = screen.getByPlaceholderText('Alias players see…');
    fireEvent.change(input, { target: { value: '  Mystery Foe  ' } });
    fireEvent.blur(input);
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      playerAlias: 'Mystery Foe',
    });
  });

  it('clears an existing alias to undefined', () => {
    const actions = makeActions();
    render(
      <CreaturePlayersRow
        entity={makeEntity({ playerAlias: 'Old' })}
        actions={actions}
      />
    );
    const input = screen.getByPlaceholderText('Alias players see…');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      playerAlias: undefined,
    });
  });

  it('skips onUpdate when the trimmed alias is unchanged', () => {
    const actions = makeActions();
    render(
      <CreaturePlayersRow
        entity={makeEntity({ playerAlias: 'Shade' })}
        actions={actions}
      />
    );
    const input = screen.getByPlaceholderText('Alias players see…');
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: ' Shade ' } });
    fireEvent.blur(input);
    expect(actions.onUpdate).not.toHaveBeenCalled();
  });

  it('resyncs the alias field when playerAlias changes elsewhere', () => {
    const actions = makeActions();
    const { rerender } = render(
      <CreaturePlayersRow
        entity={makeEntity({ playerAlias: 'Shade' })}
        actions={actions}
      />
    );
    rerender(
      <CreaturePlayersRow
        entity={makeEntity({ playerAlias: 'Wraith' })}
        actions={actions}
      />
    );
    expect(screen.getByPlaceholderText('Alias players see…')).toHaveValue(
      'Wraith'
    );
  });

  it('exposes the hidden-name toggle state and label', () => {
    const { rerender } = render(
      <CreaturePlayersRow entity={makeEntity()} actions={makeActions()} />
    );
    expect(
      screen.getByRole('button', {
        name: 'Name visible to players — click to hide',
      })
    ).toHaveAttribute('aria-pressed', 'false');
    rerender(
      <CreaturePlayersRow
        entity={makeEntity({ isHidden: true })}
        actions={makeActions()}
      />
    );
    expect(
      screen.getByRole('button', {
        name: 'Name hidden from players — click to reveal',
      })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('commits the alias on Enter', () => {
    const actions = makeActions();
    render(<CreaturePlayersRow entity={makeEntity()} actions={actions} />);
    const input = screen.getByPlaceholderText('Alias players see…');
    input.focus();
    fireEvent.change(input, { target: { value: 'Mystery Foe' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).not.toHaveFocus();
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      playerAlias: 'Mystery Foe',
    });
  });

  it('shows the players-see preview text', () => {
    render(
      <CreaturePlayersRow
        entity={makeEntity({ isHidden: true, hpVisibleToPlayers: true })}
        actions={makeActions()}
      />
    );
    expect(screen.getByText(/Players see:/).closest('p')).toHaveTextContent(
      'Players see: Enemy · exact HP'
    );
  });
});
