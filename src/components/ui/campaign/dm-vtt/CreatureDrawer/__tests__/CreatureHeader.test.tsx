import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { CreatureHeader } from '../CreatureHeader';
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

function makeActions(overrides: Partial<EntityActions> = {}): EntityActions {
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
    ...overrides,
  };
}

function baseProps(
  overrides: Partial<ComponentProps<typeof CreatureHeader>> = {}
) {
  return {
    entity: makeEntity(),
    actions: makeActions(),
    isTurn: false,
    editing: false,
    onToggleEditing: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('CreatureHeader', () => {
  it('commits a trimmed rename on Enter and does not commit an unchanged name', () => {
    const actions = makeActions();
    render(<CreatureHeader {...baseProps({ actions })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Combatant name' });
    fireEvent.change(input, { target: { value: '  Goblin Warlord  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      name: 'Goblin Warlord',
    });
  });

  it('cancels rename on Escape without committing', () => {
    const actions = makeActions();
    render(<CreatureHeader {...baseProps({ actions })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Combatant name' });
    fireEvent.change(input, { target: { value: 'Something Else' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(actions.onUpdate).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('textbox', { name: 'Combatant name' })
    ).not.toBeInTheDocument();
  });

  it('does not commit when the name is unchanged', () => {
    const actions = makeActions();
    render(<CreatureHeader {...baseProps({ actions })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Combatant name' });
    fireEvent.blur(input);
    expect(actions.onUpdate).not.toHaveBeenCalled();
  });

  it('calls onShortRest and onLongRest with the entity id', () => {
    const actions = makeActions();
    render(<CreatureHeader {...baseProps({ actions })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Short rest' }));
    fireEvent.click(screen.getByRole('button', { name: 'Long rest' }));
    expect(actions.onShortRest).toHaveBeenCalledWith('e1');
    expect(actions.onLongRest).toHaveBeenCalledWith('e1');
  });

  it('confirms before removing, and only removes when confirmed', () => {
    const actions = makeActions();
    const confirmSpy = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    render(<CreatureHeader {...baseProps({ actions })} />);
    const removeButton = screen.getByRole('button', {
      name: 'Remove from combat',
    });
    fireEvent.click(removeButton);
    expect(actions.onRemove).not.toHaveBeenCalled();
    fireEvent.click(removeButton);
    expect(confirmSpy).toHaveBeenCalledWith('Remove Goblin Boss from combat?');
    expect(actions.onRemove).toHaveBeenCalledWith('e1');
    confirmSpy.mockRestore();
  });

  it('shows the eye button only for entities with both npcSourceId and onViewNPC', () => {
    const actions = makeActions({ onViewNPC: vi.fn() });
    const { rerender } = render(
      <CreatureHeader
        {...baseProps({
          actions,
          entity: makeEntity({ npcSourceId: 'npc-1' }),
        })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'View NPC details' }));
    expect(actions.onViewNPC).toHaveBeenCalledWith('npc-1', 'e1');

    rerender(
      <CreatureHeader {...baseProps({ actions, entity: makeEntity() })} />
    );
    expect(
      screen.queryByRole('button', { name: 'View NPC details' })
    ).not.toBeInTheDocument();
  });

  it('does not show the eye button when npcSourceId is set but onViewNPC is absent', () => {
    render(
      <CreatureHeader
        {...baseProps({ entity: makeEntity({ npcSourceId: 'npc-1' }) })}
      />
    );
    expect(
      screen.queryByRole('button', { name: 'View NPC details' })
    ).not.toBeInTheDocument();
  });

  it('toggles the lock/play button and reflects aria-pressed', () => {
    const onToggleEditing = vi.fn();
    const { rerender } = render(
      <CreatureHeader {...baseProps({ onToggleEditing, editing: false })} />
    );
    const button = screen.getByRole('button', { name: 'Play' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(onToggleEditing).toHaveBeenCalled();

    rerender(
      <CreatureHeader {...baseProps({ onToggleEditing, editing: true })} />
    );
    expect(screen.getByRole('button', { name: 'Editing' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('calls onClose', () => {
    const onClose = vi.fn();
    render(<CreatureHeader {...baseProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close sheet' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('hides rest buttons and the lock toggle for a lair entity, but keeps Remove', () => {
    render(
      <CreatureHeader
        {...baseProps({ entity: makeEntity({ type: 'lair' }) })}
      />
    );
    expect(
      screen.queryByRole('button', { name: 'Short rest' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Long rest' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Play' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Close sheet' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove from combat' })
    ).toBeInTheDocument();
  });

  it('still shows Eye for a lair entity when npcSourceId and onViewNPC exist — parity with DetailHeader', () => {
    const actions = makeActions({ onViewNPC: vi.fn() });
    render(
      <CreatureHeader
        {...baseProps({
          actions,
          entity: makeEntity({ type: 'lair', npcSourceId: 'npc-1' }),
        })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'View NPC details' }));
    expect(actions.onViewNPC).toHaveBeenCalledWith('npc-1', 'e1');
  });

  it('shows "Their turn" badge and the concentration chip when applicable', () => {
    render(
      <CreatureHeader
        {...baseProps({
          isTurn: true,
          entity: makeEntity({ concentrationSpell: 'Bane' }),
        })}
      />
    );
    expect(screen.getByText('Their turn')).toBeInTheDocument();
    expect(screen.getByText('Bane')).toBeInTheDocument();
  });
});
