import type { EncounterEntity } from '@/types/encounter';
import { rollHitDie } from '../spendHitDie';
import type { EntityActions } from '../types';

/** Death saves show for players and NPCs (or npc-sourced monsters) down at 0 HP. */
export function showDeathSaves(entity: EncounterEntity): boolean {
  return (
    (entity.type === 'player' ||
      entity.type === 'npc' ||
      !!entity.npcSourceId) &&
    entity.currentHp <= 0 &&
    entity.deathSaves != null
  );
}

/** Whether the "Spend Hit Die" control should render for this entity. */
export function canSpendHitDie(entity: EncounterEntity): boolean {
  return (
    (entity.type === 'npc' || entity.npcSourceId != null) &&
    entity.hitDice != null &&
    entity.hitDice.current > 0 &&
    entity.currentHp > 0 &&
    entity.currentHp < entity.maxHp
  );
}

/** Rolls a hit die and applies the heal + hit dice decrement; no-op if none available. */
export function spendHitDie(
  entity: EncounterEntity,
  actions: EntityActions
): void {
  const result = rollHitDie(entity);
  if (result) {
    actions.onHeal(entity.id, result.healAmount);
    actions.onUpdate(entity.id, { hitDice: result.hitDice });
  }
}
