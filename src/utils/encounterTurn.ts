import type { Encounter, EncounterEntity } from '@/types/encounter';

export function getOnDeckEntity(encounter: Encounter): EncounterEntity | null {
  if (!encounter.isActive || encounter.entities.length < 2) {
    return null;
  }
  const nextIndex = (encounter.currentTurn + 1) % encounter.entities.length;
  return encounter.entities[nextIndex] ?? null;
}
