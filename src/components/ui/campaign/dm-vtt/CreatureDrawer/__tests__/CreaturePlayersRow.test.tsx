import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render as rtlRender,
  screen,
  within,
} from '@testing-library/react';

import { TooltipProvider } from '@/components/ui/primitives/Tooltip';
import { CreaturePlayersRow } from '../CreaturePlayersRow';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

// The row's Tooltips need the provider CreatureSheet wraps around it, and
// Radix measures the trigger with ResizeObserver.
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

  it('groups disposition with aria-pressed', () => {
    const actions = makeActions();
    render(<CreaturePlayersRow entity={makeEntity()} actions={actions} />);
    const group = screen.getByRole('group', { name: 'Player disposition' });
    const ally = within(group).getByRole('button', { name: 'Ally' });
    expect(
      within(group).getByRole('button', { name: 'Enemy' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(ally).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(ally);
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      playerDisposition: 'ally',
    });
  });

  it('labels the name toggle by what it will do', () => {
    const actions = makeActions();
    const { rerender } = render(
      <CreaturePlayersRow entity={makeEntity()} actions={actions} />
    );
    const hide = screen.getByRole('button', { name: 'Hide name from players' });
    expect(hide).not.toHaveAttribute('data-selected');
    expect(hide).not.toHaveAttribute('aria-pressed');
    fireEvent.click(hide);
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', { isHidden: true });

    rerender(
      <CreaturePlayersRow
        entity={makeEntity({ isHidden: true })}
        actions={actions}
      />
    );
    const show = screen.getByRole('button', { name: 'Show name to players' });
    expect(show).toHaveAttribute('data-selected', 'true');
    expect(show).not.toHaveAttribute('aria-pressed');
    fireEvent.click(show);
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', { isHidden: false });
  });

  it('labels the HP toggle by what it will do', () => {
    const actions = makeActions();
    const { rerender } = render(
      <CreaturePlayersRow entity={makeEntity()} actions={actions} />
    );
    const show = screen.getByRole('button', {
      name: 'Show exact HP to players',
    });
    expect(show).not.toHaveAttribute('data-selected');
    expect(show).not.toHaveAttribute('aria-pressed');
    fireEvent.click(show);
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      hpVisibleToPlayers: true,
    });

    rerender(
      <CreaturePlayersRow
        entity={makeEntity({ hpVisibleToPlayers: true })}
        actions={actions}
      />
    );
    const hide = screen.getByRole('button', { name: 'Hide HP from players' });
    expect(hide).toHaveAttribute('data-selected', 'true');
    expect(hide).not.toHaveAttribute('aria-pressed');
    fireEvent.click(hide);
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      hpVisibleToPlayers: false,
    });
  });

  it('heads the row and previews what players see', () => {
    render(
      <CreaturePlayersRow entity={makeEntity()} actions={makeActions()} />
    );
    expect(
      screen.getByRole('heading', { level: 4, name: 'Players' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Players see:/)).toBeInTheDocument();
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
