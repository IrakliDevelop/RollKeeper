// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CombatConfigDialog } from '@/components/ui/encounter/CombatConfigDialog';
import { DetailEffects } from '@/components/ui/encounter/combat-screen/detail/DetailEffects';
import { useEncounterStore } from '@/store/encounterStore';
import { DEFAULT_COMBAT_CONFIG, type EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

vi.mock('@/hooks/useOfficialConditions', () => ({
  useOfficialConditions: () => ({ conditions: [], loading: false }),
}));
vi.mock('@/hooks/usePaletteSpellEffects', () => ({
  usePaletteSpellEffects: () => ({ effects: [], loading: false }),
}));

const entity: EncounterEntity = {
  id: 'custom-status-target',
  type: 'npc',
  name: 'Target',
  initiative: 10,
  initiativeModifier: 0,
  currentHp: 10,
  maxHp: 10,
  tempHp: 0,
  armorClass: 10,
  conditions: [],
};

describe('custom combat statuses', () => {
  beforeEach(() => {
    useEncounterStore.setState({
      encounters: [],
      activeEncounterId: null,
      combatConfig: { ...DEFAULT_COMBAT_CONFIG, customConditions: [] },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('saves a full custom condition from the Custom conditions section', async () => {
    const user = userEvent.setup();
    render(<CombatConfigDialog open onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole('tab', { name: 'Custom conditions' }));
    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.type(screen.getByLabelText('Condition name'), 'Cursed Blood');
    await user.type(
      screen.getByLabelText('Condition description'),
      'Lose 1d4 HP at the start of each turn.'
    );
    // Popover-in-Dialog: fireEvent, same as event-dialog-marker.test.tsx.
    fireEvent.click(
      screen.getByRole('button', { name: 'Condition icon: trending-down' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'droplet' }));
    // An unnamed row must be dropped on save.
    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(useEncounterStore.getState().combatConfig.customConditions).toEqual([
      {
        id: expect.any(String),
        name: 'Cursed Blood',
        description: 'Lose 1d4 HP at the start of each turn.',
        icon: 'droplet',
        kind: 'debuff',
      },
    ]);
  });

  it('switches config tabs with the arrow key and returns to visibility on reopen', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CombatConfigDialog open onOpenChange={vi.fn()} />
    );
    const visibility = screen.getByRole('tab', { name: 'Player visibility' });
    visibility.focus();
    await user.keyboard('{ArrowRight}');
    expect(
      screen.getByRole('tab', { name: 'Custom conditions' })
    ).toHaveFocus();
    expect(
      screen.getByRole('tab', { name: 'Custom conditions' })
    ).toHaveAttribute('data-state', 'active');
    rerender(<CombatConfigDialog open={false} onOpenChange={vi.fn()} />);
    rerender(<CombatConfigDialog open onOpenChange={vi.fn()} />);
    expect(
      screen.getByRole('tab', { name: 'Player visibility' })
    ).toHaveAttribute('data-state', 'active');
  });

  it('names each editable HP band and removes the chosen row without losing focus', async () => {
    const user = userEvent.setup();
    render(<CombatConfigDialog open onOpenChange={vi.fn()} />);
    await user.click(screen.getByRole('radio', { name: /State label/i }));
    expect(
      screen.getByRole('textbox', { name: 'Band 1 threshold (%)' })
    ).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Band 1 label' })).toHaveValue(
      'Healthy'
    );
    const remove = screen.getByRole('button', { name: 'Remove Healthy band' });
    await user.click(remove);
    expect(screen.queryByDisplayValue('Healthy')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add band' })).toHaveFocus();
  });

  it('offers saved conditions in the combatant palette and applies icon + description', async () => {
    const user = userEvent.setup();
    useEncounterStore.getState().setCombatConfig({
      customConditions: [
        {
          id: 'cc-marked',
          name: 'Marked',
          description: 'The hunter always knows where you are.',
          icon: 'crosshair',
          kind: 'debuff',
        },
      ],
    });
    const onAddCondition = vi.fn();
    const actions = { onAddCondition } as unknown as EntityActions;

    render(<DetailEffects entity={entity} actions={actions} />);
    await user.click(screen.getByRole('button', { name: 'Marked' }));

    expect(onAddCondition).toHaveBeenCalledWith(entity.id, {
      name: 'Marked',
      description: 'The hunter always knows where you are.',
      icon: 'crosshair',
      kind: 'debuff',
      source: 'dm',
      origin: 'custom',
    });
  });
});
