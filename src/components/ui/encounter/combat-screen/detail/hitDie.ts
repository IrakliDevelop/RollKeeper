import type { EncounterEntity } from '@/types/encounter';
import { rollHitDie } from '../spendHitDie';
import type { EntityActions } from '../types';

/** Tailwind text color for current/max HP, by percentage remaining. */
export function hpColorClass(current: number, max: number): string {
  const pct = max > 0 ? (current / max) * 100 : 0;
  if (pct > 50) return 'text-accent-emerald-text';
  if (pct > 25) return 'text-accent-amber-text';
  return 'text-accent-red-text';
}

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
