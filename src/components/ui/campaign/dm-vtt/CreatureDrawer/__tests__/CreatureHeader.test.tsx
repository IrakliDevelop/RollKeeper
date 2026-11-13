import type { ComponentProps, ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render as rtlRender,
  screen,
} from '@testing-library/react';

import { TooltipProvider } from '@/components/ui/primitives/Tooltip';
import { CreatureHeader } from '../CreatureHeader';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';
import {
  clickConfirmDialogButton,
  findConfirmDialog,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';

// The header's Tooltips need the provider CreatureSheet wraps around it, and
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
    fireEvent.click(screen.getByRole('button', { name: 'Rename Goblin Boss' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Rename Goblin Boss' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Rename Goblin Boss' }));
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

  it('confirms before removing, and only removes when confirmed', async () => {
    const actions = makeActions();
    renderConfirmDialogHost();
    render(<CreatureHeader {...baseProps({ actions })} />);
    const removeButton = screen.getByRole('button', {
      name: 'Remove Goblin Boss from combat',
    });
    fireEvent.click(removeButton);
    await clickConfirmDialogButton('Cancel');
    expect(actions.onRemove).not.toHaveBeenCalled();

    fireEvent.click(removeButton);
    expect(await findConfirmDialog()).toHaveAccessibleName(
      'Remove Goblin Boss from combat?'
    );
    await clickConfirmDialogButton('Remove from combat');
    expect(actions.onRemove).toHaveBeenCalledWith('e1');
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
    fireEvent.click(
      screen.getByRole('button', { name: 'View Goblin Boss in NPC library' })
    );
    expect(actions.onViewNPC).toHaveBeenCalledWith('npc-1', 'e1');

    rerender(
      <CreatureHeader {...baseProps({ actions, entity: makeEntity() })} />
    );
    expect(
      screen.queryByRole('button', { name: 'View Goblin Boss in NPC library' })
    ).not.toBeInTheDocument();
  });

  it('does not show the eye button when npcSourceId is set but onViewNPC is absent', () => {
    render(
      <CreatureHeader
        {...baseProps({ entity: makeEntity({ npcSourceId: 'npc-1' }) })}
      />
    );
    expect(
      screen.queryByRole('button', { name: 'View Goblin Boss in NPC library' })
    ).not.toBeInTheDocument();
  });

  it('toggles editing with the Edit sheet switch', () => {
    const onToggleEditing = vi.fn();
    const { rerender } = render(
      <CreatureHeader {...baseProps({ onToggleEditing, editing: false })} />
    );
    const toggle = screen.getByRole('switch', { name: 'Edit sheet' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(onToggleEditing).toHaveBeenCalled();

    rerender(
      <CreatureHeader {...baseProps({ onToggleEditing, editing: true })} />
    );
    expect(screen.getByRole('switch', { name: 'Edit sheet' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(
      screen.queryByRole('button', { name: /^(play|editing)$/i })
    ).toBeNull();
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
      screen.queryByRole('switch', { name: 'Edit sheet' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Close sheet' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove Goblin Boss from combat' })
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
    fireEvent.click(
      screen.getByRole('button', { name: 'View Goblin Boss in NPC library' })
    );
    expect(actions.onViewNPC).toHaveBeenCalledWith('npc-1', 'e1');
  });

  it('shows kind, CR and current turn as badges', () => {
    render(
      <CreatureHeader
        {...baseProps({
          isTurn: true,
          entity: makeEntity({ monsterStatBlock: { cr: '1/4' } as never }),
        })}
      />
    );
    expect(screen.getByText('Monster')).toBeInTheDocument();
    expect(screen.getByText('CR 1/4')).toBeInTheDocument();
    expect(screen.getByText('Current turn')).toBeInTheDocument();
    expect(screen.queryByText('Their turn')).toBeNull();
  });

  it('shows concentration as a concentration chip', () => {
    render(
      <CreatureHeader
        {...baseProps({ entity: makeEntity({ concentrationSpell: 'Bane' }) })}
      />
    );
    expect(
      screen
        .getByText('Concentrating on Bane')
        .closest('[data-kind="concentration"]')
    ).not.toBeNull();
  });

  it('renames via a labelled button', () => {
    const actions = makeActions();
    render(<CreatureHeader {...baseProps({ actions })} />);
    const rename = screen.getByRole('button', { name: 'Rename Goblin Boss' });
    expect(rename).toHaveAttribute('data-variant', 'ghost');
    fireEvent.click(rename);
    const input = screen.getByRole('textbox', { name: 'Combatant name' });
    fireEvent.change(input, { target: { value: 'Goblin Chief' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      name: 'Goblin Chief',
    });
  });

  it('remove is a danger button and asks first', async () => {
    const actions = makeActions({ onViewNPC: vi.fn() });
    renderConfirmDialogHost();
    const { container } = render(
      <CreatureHeader
        {...baseProps({
          actions,
          entity: makeEntity({ npcSourceId: 'npc-1' }),
        })}
      />
    );
    const remove = screen.getByRole('button', {
      name: 'Remove Goblin Boss from combat',
    });
    expect(remove).toHaveAttribute('data-variant', 'danger');
    for (const name of [
      'Short rest',
      'Long rest',
      'View Goblin Boss in NPC library',
    ]) {
      expect(screen.getByRole('button', { name })).toHaveAttribute(
        'data-variant',
        'ghost'
      );
    }

    // Only the rename trigger keeps a `title` (SideDrawer focuses it on open,
    // so a Radix Tooltip there would open every time).
    const titled = container.querySelectorAll('[title]');
    expect(titled).toHaveLength(1);
    expect(titled[0]).toBe(
      screen.getByRole('button', { name: 'Rename Goblin Boss' })
    );

    fireEvent.click(remove);
    expect(await findConfirmDialog()).toHaveAccessibleName(
      'Remove Goblin Boss from combat?'
    );
    await clickConfirmDialogButton('Cancel');
    expect(actions.onRemove).not.toHaveBeenCalled();
  });
});
