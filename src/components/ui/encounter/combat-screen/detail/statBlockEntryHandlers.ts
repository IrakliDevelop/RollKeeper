import type { EncounterEntity, StatBlockEntry } from '@/types/encounter';
import type { EntityActions } from '../types';

export interface StatBlockEntryHandlers {
  onUseEntry: (entry: StatBlockEntry) => void;
  onUseAbilityEntry: (entry: StatBlockEntry) => void;
  onRestoreAbilityEntry: (entry: StatBlockEntry) => void;
}

/**
 * `StatBlockTraits`' three entry-use callbacks, wired to an entity's
 * `EntityActions`. Extracted from `DetailActions` so the drawer's
 * `ActionsTab` can reuse the exact same wiring.
 */
export function statBlockEntryHandlers(
  entity: EncounterEntity,
  actions: EntityActions
): StatBlockEntryHandlers {
  return {
    onUseEntry: (entry: StatBlockEntry) => {
      if (entry.inventoryCost && entry.id) {
        actions.onUseInventoryEntry?.(entity.id, entry.id);
      } else if (entry.resourceCost) {
        actions.onSpendResource(
          entity.id,
          entry.resourceCost.resourceId,
          entry.resourceCost.amount
        );
      }
    },
    onUseAbilityEntry: (entry: StatBlockEntry) => {
      if (entry.id) actions.onUseAbility(entity.id, entry.id);
    },
    onRestoreAbilityEntry: (entry: StatBlockEntry) => {
      if (entry.id) actions.onRestoreAbility(entity.id, entry.id);
    },
  };
}
