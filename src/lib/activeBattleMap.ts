import type { SharedBattleMapState } from '@/types/sharedState';

/**
 * The shared battle-map pointer (`campaign:<code>:battlemap`) is sticky: it is
 * only ever overwritten by a positive push (manual share toggle or start-combat
 * with a linked map), never cleared. So deleting the map it references would
 * strand players on a dead id. Decide whether a delete of `deletedMapId` should
 * clear that pointer. Redis may hand back the value as an object or a raw JSON
 * string; unparseable input is treated as "nothing to clear" (never throws).
 */
export function shouldClearActiveBattleMap(
  raw: string | SharedBattleMapState | null | undefined,
  deletedMapId: string
): boolean {
  if (!raw) return false;
  let parsed: SharedBattleMapState | null;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as SharedBattleMapState;
    } catch {
      return false;
    }
  } else {
    parsed = raw;
  }
  return parsed?.activeBattleMapId === deletedMapId;
}
