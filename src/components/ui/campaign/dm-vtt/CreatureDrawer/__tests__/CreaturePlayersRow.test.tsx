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
  it('returns null for a lair entity', () => {
    const { container } = render(
      <CreaturePlayersRow
        entity={makeEntity({ type: 'lair' })}
        actions={makeActions()}
      />
    );
    expect(container).toBeEmptyDOMElement();
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

    vi.mocked(actions.onUpdate).mockClear();
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      playerAlias: undefined,
    });
  });

  it('commits the alias on Enter', () => {
    const actions = makeActions();
    render(<CreaturePlayersRow entity={makeEntity()} actions={actions} />);
    const input = screen.getByPlaceholderText('Alias players see…');
    fireEvent.change(input, { target: { value: 'Mystery Foe' } });
    fireEvent.keyDown(input, { key: 'Enter' });
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
