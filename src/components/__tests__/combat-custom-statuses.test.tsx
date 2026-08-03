// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CombatConfigDialog } from '@/components/ui/encounter/CombatConfigDialog';
import { DetailEffects } from '@/components/ui/encounter/combat-screen/detail/DetailEffects';
import { useEncounterStore } from '@/store/encounterStore';
import { DEFAULT_COMBAT_CONFIG, type EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

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
      combatConfig: { ...DEFAULT_COMBAT_CONFIG, customStatuses: [] },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('saves reusable statuses from combat configuration', async () => {
    const user = userEvent.setup();
    render(<CombatConfigDialog open onOpenChange={vi.fn()} />);

    await user.type(screen.getByLabelText('Status name'), 'Marked');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(useEncounterStore.getState().combatConfig.customStatuses).toEqual([
      'Marked',
    ]);
  });

  it('offers saved statuses in the combatant condition palette', async () => {
    const user = userEvent.setup();
    useEncounterStore.getState().setCombatConfig({
      customStatuses: ['Marked'],
    });
    const onAddCondition = vi.fn();
    const actions = { onAddCondition } as unknown as EntityActions;

    render(<DetailEffects entity={entity} actions={actions} />);
    await user.click(screen.getByRole('button', { name: 'Marked' }));

    expect(onAddCondition).toHaveBeenCalledWith(entity.id, {
      name: 'Marked',
      kind: 'debuff',
      source: 'dm',
    });
  });
});
