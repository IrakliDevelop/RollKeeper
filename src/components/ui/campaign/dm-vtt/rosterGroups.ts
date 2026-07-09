import type { EncounterEntity } from '@/types/encounter';

export interface RosterGroups {
  players: EncounterEntity[];
  npcs: EncounterEntity[];
  monsters: EncounterEntity[];
}

/** Splits roster entities into the tray's three display groups. Lair
 * entities (`type: 'lair'`) carry no token and are omitted entirely. */
export function groupRosterEntities(entities: EncounterEntity[]): RosterGroups {
  const groups: RosterGroups = { players: [], npcs: [], monsters: [] };
  for (const entity of entities) {
    if (entity.type === 'player') groups.players.push(entity);
    else if (entity.type === 'npc') groups.npcs.push(entity);
    else if (entity.type === 'monster') groups.monsters.push(entity);
  }
  return groups;
}
