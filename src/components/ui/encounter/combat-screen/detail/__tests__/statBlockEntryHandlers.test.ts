import { describe, expect, it, vi } from 'vitest';

import { statBlockEntryHandlers } from '../statBlockEntryHandlers';
import type { EncounterEntity, StatBlockEntry } from '@/types/encounter';
import type { EntityActions } from '../../types';

function makeEntity(overrides: Partial<EncounterEntity> = {}): EncounterEntity {
  return {
    id: 'e1',
    type: 'monster',
    name: 'Goblin Boss',
    initiative: null,
    initiativeModifier: 2,
    currentHp: 10,
    maxHp: 20,
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
    onUseInventoryEntry: vi.fn(() => true),
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
    ...overrides,
  };
}

function makeEntry(overrides: Partial<StatBlockEntry> = {}): StatBlockEntry {
  return { name: 'Fire Breath', text: 'Exhale fire.', ...overrides };
}

describe('statBlockEntryHandlers', () => {
  describe('onUseEntry', () => {
    it('spends an inventory-cost entry via onUseInventoryEntry', () => {
      const entity = makeEntity();
      const actions = makeActions();
      const entry = makeEntry({
        id: 'entry-1',
        inventoryCost: { inventoryItemId: 'item-1', quantity: 1 },
      });

      statBlockEntryHandlers(entity, actions).onUseEntry(entry);

      expect(actions.onUseInventoryEntry).toHaveBeenCalledWith('e1', 'entry-1');
      expect(actions.onSpendResource).not.toHaveBeenCalled();
    });

    it('spends a resource-cost entry via onSpendResource', () => {
      const entity = makeEntity();
      const actions = makeActions();
      const entry = makeEntry({
        resourceCost: { resourceId: 'res-1', amount: 2 },
      });

      statBlockEntryHandlers(entity, actions).onUseEntry(entry);

      expect(actions.onSpendResource).toHaveBeenCalledWith('e1', 'res-1', 2);
    });

    it('does nothing for an entry with neither cost', () => {
      const entity = makeEntity();
      const actions = makeActions();

      statBlockEntryHandlers(entity, actions).onUseEntry(makeEntry());

      expect(actions.onUseInventoryEntry).not.toHaveBeenCalled();
      expect(actions.onSpendResource).not.toHaveBeenCalled();
    });
  });

  describe('onUseAbilityEntry', () => {
    it('uses the ability by entry id', () => {
      const entity = makeEntity();
      const actions = makeActions();

      statBlockEntryHandlers(entity, actions).onUseAbilityEntry(
        makeEntry({ id: 'ability-1' })
      );

      expect(actions.onUseAbility).toHaveBeenCalledWith('e1', 'ability-1');
    });

    it('does nothing without an entry id', () => {
      const entity = makeEntity();
      const actions = makeActions();

      statBlockEntryHandlers(entity, actions).onUseAbilityEntry(makeEntry());

      expect(actions.onUseAbility).not.toHaveBeenCalled();
    });
  });

  describe('onRestoreAbilityEntry', () => {
    it('restores the ability by entry id', () => {
      const entity = makeEntity();
      const actions = makeActions();

      statBlockEntryHandlers(entity, actions).onRestoreAbilityEntry(
        makeEntry({ id: 'ability-1' })
      );

      expect(actions.onRestoreAbility).toHaveBeenCalledWith('e1', 'ability-1');
    });

    it('does nothing without an entry id', () => {
      const entity = makeEntity();
      const actions = makeActions();

      statBlockEntryHandlers(entity, actions).onRestoreAbilityEntry(
        makeEntry()
      );

      expect(actions.onRestoreAbility).not.toHaveBeenCalled();
    });
  });
});
