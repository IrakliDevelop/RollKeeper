import type { BattleMap } from '@/types/battlemap';

/**
 * First map whose linkedEncounterIds contains the encounter.
 * Deliberately first-wins: the old EncounterList memo was incidentally
 * last-wins when an encounter was linked from several maps, a degenerate
 * state the picker's switch flow (link new + unlink old) prevents;
 * first-wins makes the resolution deterministic by list order.
 */
export function findLinkedBattleMap(
  battleMaps: BattleMap[],
  encounterId: string
): BattleMap | undefined {
  return battleMaps.find(bm => bm.linkedEncounterIds.includes(encounterId));
}

/**
 * Store writes needed to make nextMapId the encounter's linked map.
 * Selecting the already-current map plans no writes (plain navigation).
 * From the encounter's side the relationship is 1:1 — switching unlinks
 * the previous map; a map's multi-encounter array is otherwise untouched.
 */
export function planMapLinkSwitch(
  currentMapId: string | null,
  nextMapId: string
): { linkTo: string | null; unlinkFrom: string | null } {
  if (currentMapId === nextMapId) return { linkTo: null, unlinkFrom: null };
  return { linkTo: nextMapId, unlinkFrom: currentMapId };
}
