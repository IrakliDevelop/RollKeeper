// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CombatantRow } from '@/components/ui/encounter/combat-screen/CombatantRow';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

afterEach(cleanup);

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

const lairEntity: EncounterEntity = {
  ...mockEntity,
  id: 'lair-1',
  type: 'lair',
  name: 'Vampire Lair',
};

const entityWithCondition: EncounterEntity = {
  ...mockEntity,
  conditions: [{ id: 'c1', name: 'Poisoned' }],
};

function makeMockActions(): EntityActions {
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

const defaultProps = {
  density: 'rail' as const,
  isActive: false,
  isSelected: false,
  isOnDeck: false,
  hidePlayerHp: false,
};

const playerEntity: EncounterEntity = {
  id: 'entity-42',
  type: 'player',
  name: 'Thorin',
  playerCharacterId: 'pc-9',
  initiative: 12,
  initiativeModifier: 1,
  currentHp: 40,
  maxHp: 50,
  tempHp: 0,
  armorClass: 18,
  conditions: [],
};

describe('CombatantRow', () => {
  it('counter + button calls onAdjustCounter with playerCharacterId, not entity.id', () => {
    const onAdjustCounter = vi.fn();
    const actions = { ...makeMockActions(), onAdjustCounter };
    render(
      <CombatantRow
        {...defaultProps}
        entity={playerEntity}
        counterLabel="Rage"
        counterValue={3}
        actions={actions}
        onSelect={vi.fn()}
      />
    );
    // The counter div has title="Rage"; its last button is the + (increment)
    const counterContainer = screen.getByTitle('Rage');
    const counterButtons = counterContainer.querySelectorAll('button');
    const plusButton = counterButtons[counterButtons.length - 1];
    fireEvent.click(plusButton);
    // Must be called with playerCharacterId='pc-9', NOT entity.id='entity-42'
    expect(onAdjustCounter).toHaveBeenCalledWith('pc-9', 1);
    expect(onAdjustCounter).not.toHaveBeenCalledWith('entity-42', 1);
  });

  it('renders name, initiative, AC and HP', () => {
    const actions = makeMockActions();
    render(
      <CombatantRow
        {...defaultProps}
        entity={mockEntity}
        actions={actions}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByTitle('Click to set initiative')).toHaveTextContent(
      '15'
    );
    expect(screen.getByText('7/7')).toBeInTheDocument();
    expect(screen.getByTestId('ac-section')).toBeInTheDocument();
  });

  it('calls onSelect when row clicked', () => {
    const actions = makeMockActions();
    const onSelect = vi.fn();
    const { container } = render(
      <CombatantRow
        {...defaultProps}
        entity={mockEntity}
        actions={actions}
        onSelect={onSelect}
      />
    );
    fireEvent.click(container.firstChild as Element);
    expect(onSelect).toHaveBeenCalled();
  });

  it('on-deck entity shows ON DECK pill', () => {
    const actions = makeMockActions();
    render(
      <CombatantRow
        {...defaultProps}
        entity={mockEntity}
        actions={actions}
        onSelect={vi.fn()}
        isOnDeck={true}
      />
    );
    expect(screen.getByText('ON DECK')).toBeInTheDocument();
  });

  it('editing initiative calls onSetInitiative', async () => {
    const actions = makeMockActions();
    const user = userEvent.setup();
    render(
      <CombatantRow
        {...defaultProps}
        entity={mockEntity}
        actions={actions}
        onSelect={vi.fn()}
      />
    );
    await user.click(screen.getByTitle('Click to set initiative'));
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '20');
    await user.keyboard('{Enter}');
    expect(actions.onSetInitiative).toHaveBeenCalledWith('e1', 20);
  });

  it('remove condition chip calls onRemoveCondition', async () => {
    const actions = makeMockActions();
    const user = userEvent.setup();
    render(
      <CombatantRow
        {...defaultProps}
        entity={entityWithCondition}
        actions={actions}
        onSelect={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: /remove poisoned/i }));
    expect(actions.onRemoveCondition).toHaveBeenCalledWith('e1', 'c1');
  });

  it('rail density caps visible conditions at 2 with +N overflow', () => {
    const actions = makeMockActions();
    const conditions = [
      'Blinded',
      'Charmed',
      'Deafened',
      'Frightened',
      'Poisoned',
    ].map((name, i) => ({ id: `c${i}`, name }));
    render(
      <CombatantRow
        {...defaultProps}
        entity={{ ...mockEntity, conditions }}
        actions={actions}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('Blinded')).toBeInTheDocument();
    expect(screen.getByText('Charmed')).toBeInTheDocument();
    expect(screen.queryByText('Deafened')).not.toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('lair entity hides HP and AC', () => {
    const actions = makeMockActions();
    render(
      <CombatantRow
        {...defaultProps}
        entity={lairEntity}
        actions={actions}
        onSelect={vi.fn()}
      />
    );
    expect(screen.queryByText('7/7')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ac-section')).not.toBeInTheDocument();
  });
});
