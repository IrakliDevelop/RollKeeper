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
    onSpendResource: vi.fn(() => true),
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
    fireEvent.click(
      screen.getByRole('button', { name: 'Increase Rage for Thorin' })
    );
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
    expect(
      screen.getByRole('textbox', { name: 'Goblin initiative' })
    ).toHaveValue('15');
    expect(screen.getByText('7/7')).toBeInTheDocument();
    expect(screen.getByTestId('ac-section')).toBeInTheDocument();
  });

  it('calls onSelect when row clicked', () => {
    const actions = makeMockActions();
    const onSelect = vi.fn();
    render(
      <CombatantRow
        {...defaultProps}
        entity={mockEntity}
        actions={actions}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Goblin details' }));
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
    expect(screen.getByText('On deck')).toBeInTheDocument();
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
    const input = screen.getByRole('textbox', { name: 'Goblin initiative' });
    await user.clear(input);
    await user.type(input, '20.5');
    await user.keyboard('{Enter}');
    expect(actions.onSetInitiative).toHaveBeenCalledWith('e1', 20.5);
    expect(input).toHaveFocus();
  });

  it('restores initiative on Escape without saving', async () => {
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
    const input = screen.getByRole('textbox', { name: 'Goblin initiative' });
    await user.clear(input);
    await user.type(input, '19');
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('15');
    expect(input).toHaveFocus();
    expect(actions.onSetInitiative).not.toHaveBeenCalled();
  });

  it('restores initiative when an empty edit is committed or blurred', async () => {
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
    const input = screen.getByRole('textbox', { name: 'Goblin initiative' });
    await user.clear(input);
    await user.tab();
    expect(input).toHaveValue('15');
    await user.click(input);
    await user.clear(input);
    await user.keyboard('{Enter}');
    expect(input).toHaveValue('15');
    expect(actions.onSetInitiative).not.toHaveBeenCalled();
  });

  it('names non-player allegiance and dead state without color', () => {
    const actions = makeMockActions();
    render(
      <CombatantRow
        {...defaultProps}
        entity={{ ...mockEntity, playerDisposition: 'ally', currentHp: 0 }}
        actions={actions}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('Ally')).toBeVisible();
    expect(screen.getByText('Dead')).toBeVisible();
  });

  it('shows a synced player summon as an ally when no disposition was stored', () => {
    const actions = makeMockActions();
    render(
      <CombatantRow
        {...defaultProps}
        entity={{ ...mockEntity, summonOwnerId: 'pc-9' }}
        actions={actions}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('Ally')).toBeVisible();
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

  it('buffs render on their own strip and do not consume the condition cap', () => {
    const actions = makeMockActions();
    const conditions = [
      { id: 'c1', name: 'Blinded' },
      { id: 'c2', name: 'Charmed' },
      { id: 'c3', name: 'Deafened' },
      { id: 'b1', name: 'Rage', kind: 'buff' as const },
      { id: 'b2', name: 'Shield of Faith', kind: 'buff' as const },
    ];
    render(
      <CombatantRow
        {...defaultProps}
        entity={{ ...mockEntity, conditions }}
        actions={actions}
        onSelect={vi.fn()}
      />
    );
    // conditions strip: 2 visible + overflow for the 3rd only (buffs excluded)
    expect(screen.getByText('Blinded')).toBeInTheDocument();
    expect(screen.getByText('Charmed')).toBeInTheDocument();
    expect(screen.queryByText('Deafened')).not.toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    // buff strip: both visible, verdigris badge
    expect(screen.getByText('Rage')).toBeInTheDocument();
    expect(screen.getByText('Shield of Faith')).toBeInTheDocument();
    expect(screen.getByText('Rage').closest('[data-variant]')).toHaveAttribute(
      'data-variant',
      'success'
    );
  });

  it('clicking the name selects the row rather than starting a rename', () => {
    const actions = makeMockActions();
    const onSelect = vi.fn();
    render(
      <CombatantRow
        {...defaultProps}
        entity={mockEntity}
        actions={actions}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByText('Goblin'));
    expect(onSelect).toHaveBeenCalled();
    // The only textbox is the always-on initiative value.
    expect(
      screen.getByRole('textbox', { name: 'Goblin initiative' })
    ).toBeVisible();
    expect(actions.onUpdate).not.toHaveBeenCalled();
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
