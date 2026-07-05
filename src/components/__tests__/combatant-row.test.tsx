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

describe('CombatantRow', () => {
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
